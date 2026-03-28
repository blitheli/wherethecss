import { ReorientationPlugin as ReorientationPluginBase } from '3d-tiles-renderer/plugins'


/*
  扩展 3d-tiles-renderer 自带的 ReorientationPlugin，在每次 update() 时根据你存的经纬高
    调用父类已有的方法：把瓦片/场景坐标系平移（重定向），使指定 (lat, lon, height) 附近落在原点附近，减轻大坐标下的精度问题。
    
  
    update() 被引擎调用时，若你已设好经纬度，就执行一次「以该点为新的世界原点参考」的变换；没设齐则什么都不做，避免乱调用。
    
*/
//TypeScript 的「模块声明合并 / 扩充」：给已有第三方模块 3d-tiles-renderer/plugins 里的类型补字段，不改库的源码。
//表示：我要描述（或扩展）这个路径对应的模块类型。
//这里就是给 ReorientationPlugin 类型补字段，不改库的源码。
//这样做的目的：你在子类里给插件写了 this.lat = ... 之类，原库的 `.d.ts 里没有这三个属性，直接写会报类型错误；用这段声明补上后，类型检查就通过了。
//ReorientationPlugin 是 3d-tiles-renderer/plugins 里的类型，这里给 ReorientationPlugin 类型补字段，不改库的源码。
declare module '3d-tiles-renderer/plugins' {
  interface ReorientationPlugin {
    lat?: number
    lon?: number
    height?: number
  }
}

export class ReorientationPlugin extends ReorientationPluginBase {
  update(): void {
    const { lat, lon, height } = this
    if (lat != null && lon != null) {
      this.transformLatLonHeightToOrigin(lat, lon, height)
    }
  }
}
