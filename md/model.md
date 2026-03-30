
## `gltf.scene.matrixWorld` 是什么？

在 Three.js 里，**`matrixWorld` 表示这个物体在「世界坐标系」里的完整变换矩阵**（4×4），也就是：把**局部坐标**里的点变换到**场景根（世界）坐标**里时用的那一个矩阵。

对任意 `Object3D`（包括 `gltf.scene`）：

- **`matrix`**（局部矩阵）：只由本节点的 `position`、`rotation`/`quaternion`、`scale` 构成。  
- **`matrixWorld`**（世界矩阵）：**从场景根一路乘到当前节点**，即  
  `祖先的变换 × … × 父节点 × 本节点的 matrix`（在默认 `matrixAutoUpdate` 下由引擎每帧更新）。

所以 **`gltf.scene.matrixWorld` 的含义**可以概括为：

> 把 GLB 根节点 `gltf.scene` 的局部坐标变换到**当前渲染场景的世界坐标**时所用的矩阵；  
> 它**已经包含** `gltf.scene` 自身的平移/旋转/缩放，以及**所有父级**（例如外层的 `<group>`、`<primitive>` 上给 `gltf.scene` 设的 `rotation-z` 等）叠乘后的结果。

### 常见用途

- 把方向向量从世界系变到「以 `gltf.scene` 朝向为参考」的系：用 **`matrixWorld` 的旋转部分的逆（或转置，若只有旋转）** 去乘向量（你们代码里用 `setFromMatrix4(matrixWorld).transpose()` 就是在用旋转的逆）。  
- 判断物体在屏幕/世界里的实际朝向和位置。

### 和 `matrix` 的区别（一句话）

| 属性 | 含义 |
|------|------|
| `gltf.scene.matrix` | 只相对**父节点**的局部变换 |
| `gltf.scene.matrixWorld` | **相对整个场景世界**的变换（含父链） |

子网格的 `matrixWorld` 还会再乘子节点自己的局部矩阵；**`gltf.scene.matrixWorld` 不包含子物体单独的旋转**，只到这一层根节点为止。