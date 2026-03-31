/**
 * 卫星星历类，基于TLE计算卫星位置和速度
 *
 * 使用satellite.js库解析两行根数(TLE)，并在给定时间点计算卫星在ECI坐标系中的位置和速度
 *
 * 坐标系说明:
 * - ECI(Earth-Centered Inertial): 地心惯性坐标系，J2000历元
 * - ECEF(Earth-Centered Earth-Fixed): 地心地固坐标系，随地球自转
 *
 * @author blitheli 20260331
 */

import * as satellite from 'satellite.js'
import { Matrix3, Vector3, type Matrix4 } from 'three'

export interface PositionVelocity {
  position: Vector3 // ECI位置(km)
  velocity: Vector3 // ECI速度(km/s)
}

export class SatelliteEphemeris {
  private satrec: any
  private eciToEcefRotation = new Matrix3()
  private position = new Vector3()
  private velocity = new Vector3()
  private tempVector = new Vector3()

  /**
   * 构造函数
   * @param tleLine1 TLE第一行
   * @param tleLine2 TLE第二行
   */
  constructor(tleLine1: string, tleLine2: string) {
    this.satrec = satellite.twoline2satrec(tleLine1, tleLine2)
  }

  /**
   * 更新卫星位置和速度
   * @param date JavaScript Date对象
   * @returns ECI坐标系中的位置和速度
   */
  update(date: Date): PositionVelocity {
    // 计算自纪元以来的分钟数
    const positionAndVelocity = satellite.propagate(this.satrec, date)

    if (positionAndVelocity.position === false) {
      throw new Error('Satellite propagation failed')
    }

    // satellite.js返回的是km为单位
    const { position: satPosition, velocity: satVelocity } = positionAndVelocity

    this.position.set(satPosition.x, satPosition.y, satPosition.z)
    this.velocity.set(satVelocity.x!, satVelocity.y!, satVelocity.z!)

    return {
      position: this.position,
      velocity: this.velocity
    }
  }

  /**
   * 获取ECEF坐标系中的位置
   * @param date JavaScript Date对象
   * @param matrixWorldToECEF 世界坐标系到ECEF的变换矩阵
   * @returns ECEF位置
   */
  getPositionECEF(date: Date, matrixWorldToECEF: Matrix4): Vector3 {
    const { position } = this.update(date)

    // 计算ECI到ECEF的旋转矩阵（格林尼治恒星时）
    const gmst = satellite.gstime(date)
    const cosGmst = Math.cos(gmst)
    const sinGmst = Math.sin(gmst)

    this.eciToEcefRotation.set(
      cosGmst, sinGmst, 0,
      -sinGmst, cosGmst, 0,
      0, 0, 1
    )

    // 应用ECEF变换（考虑矩阵WorldToECEF）
    this.tempVector.copy(position).applyMatrix3(this.eciToEcefRotation)

    // 转换到世界坐标系（km -> m）
    const kmToMeters = 1000
    this.position.copy(this.tempVector).applyMatrix4(matrixWorldToECEF).multiplyScalar(kmToMeters)

    return this.position
  }

  /**
   * 获取ECI坐标系中的位置（原始，km单位）
   */
  getPositionECI(): Vector3 {
    return this.position.clone()
  }

  /**
   * 获取ECI坐标系中的速度（原始，km/s单位）
   */
  getVelocityECI(): Vector3 {
    return this.velocity.clone()
  }
}

/**
 * 中国空间站TLE示例（可从Celestrak.org更新）
 * 格式说明:
 * - 第一行: 卫星编号、分类、国际代号、历元、平均运动等
 * - 第二行: 卫星编号、倾角、升交点赤经、偏心率、近地点角幅、平近点角、平均运动
 */
export const TIANJONG_TLE = {
  line1: '1 58020U 24091A   26090.50000000  .00005200  00000-0  22992-3 0  9994',
  line2: '2 58020  41.4725 102.0234 0004619 296.5318 189.3824 15.49053630 12345'
}
