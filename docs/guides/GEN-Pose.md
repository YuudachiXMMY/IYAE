# 更换/添加pose
## 现在有三条路径，都会自动更新 manifest：

1. 程序化姿态（axis-angle 直接定义）

适合：简单的静态姿态或呼吸/摆动等基础动画

# 1. 编辑 worker/scripts/generate_pose_glbs.py 的 POSES 列表
#    添加新的 PoseDef 条目，定义关节旋转 + UI 元数据

# 2. 运行生成
python worker/scripts/generate_pose_glbs.py

# 输出：
#   web/public/models/poses/your-pose.glb  (GLB 文件)
#   web/lib/poses-manifest.json            (自动更新)
#   → pose-config.ts 从 manifest 导入，无需手动改 TS

2. FBX 导入（Mixamo 等外部动画）

适合：从 Mixamo 下载的动画、动捕数据

python worker/scripts/import_fbx_pose.py \
--input dance.fbx \
--name "dance-move" \
--label "Dance" \
--label-zh "舞蹈" \
--category movement \
--fps 30 \
--loop

# 输出：
#   web/public/models/poses/dance-move.glb  (经 Blender 转换)
#   web/lib/poses-manifest.json             (自动 upsert)

3. SMPL-X 参数导入（body_pose JSON）

适合：从研究数据集或姿态估计工具导出的 SMPL-X 参数

python worker/scripts/import_smplx_pose.py \
--input pose-data.json \
--name "yoga-tree" \
--label "Tree Pose" \
--label-zh "树式" \
--category lifestyle \
--loop

# 输出：
#   web/public/models/poses/yoga-tree.glb  (GLB 文件)
#   web/lib/poses-manifest.json            (自动 upsert)

---
删除姿态

目前没有 CLI 命令，需要手动操作：
1. 从 poses-manifest.json 删除对应条目
2. 删除 web/public/models/poses/xxx.glb 文件
3. 如果是程序化姿态，从 generate_pose_glbs.py 的 POSES 列表中移除

数据流总结

任一 Python 脚本 → 生成 .glb → upsert poses-manifest.json
                                        ↓
                            pose-config.ts (import JSON)
                                        ↓
                            PoseSelector / usePoseAnimation (消费)

核心原则：永远不需要手动编辑 pose-config.ts，所有变更通过 manifest
自动传播到前端。