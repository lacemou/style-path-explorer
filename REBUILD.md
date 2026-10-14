# 重建视觉图

普通读者只需网页；以下是替换素材或复现实验的开发者流程。

## 环境

本次CPU实测环境为 Python 3.12，torch 2.14.1+cpu、torchvision 0.29.1+cpu、open-clip-torch 3.3.0、timm 1.0.30、NumPy 2.5.2、Pillow 12.3.0。CPU同时运行两个神经模型，261张数据各约57秒（包含初始化；不含依赖安装、下载和图片读取）。耗时取决于机器，不能作为性能保证。

建议新建独立环境，CPU版PyTorch避免下载不需要的GPU运行库。

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .venv/Scripts/Activate.ps1
python -m pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
```

## 显式下载

```bash
python scripts/download_models.py
```

该脚本会联网：从Meta下载DINOv2 ViT-S/14权重，从指定LAION模型的固定revision下载OpenCLIP权重，获取固定DINOv2代码。下载路径、字节数、SHA-256与revision记录在 `research/model-lock.json`，本地文件保存在忽略的 `.runtime/models/`。

新项目默认复用已附带的model-lock；不要为了更新模型悄悄替换版本。下载脚本遇到已缓存文件先核验锁定哈希，不通过则停止，避免继续使用错误文件。模型权重不提交仓库。

## 提取与建图

```bash
python scripts/features.py --method baseline
python scripts/features.py --method dino --weights .runtime/models/dinov2_vits14_pretrain.pth --dino-repo .runtime/models/dinov2-code
python scripts/features.py --method clip --weights .runtime/models/open_clip_pytorch_model.bin
python scripts/graph.py --select dino --k 5 --quantile .90
python scripts/verify.py
```

推理脚本只接受本地权重，不暗中下载。图片保留完整画面，填充为224方图后按各模型规范处理。特征保存为 `.runtime/features/` 中的NumPy文件；特征元数据记录图片编号、资料版本、权重哈希和耗时。

正式模型与图配置可以改变，但必须更新图版本、重新检查代表性路线，并重新选择示例。`data/examples.json` 只是端点列表，路径由图计算，不在其中手工保存一条美化路线。

## 默认库的来源核对

`prepare.py --upstream <对应快照catalog/styles.json>` 可检查默认库的名称、参考作者和traits是否逐项一致。`data/manifest.json`记录每张图片的哈希；构建前后都可运行verify检查。

如果使用自己的资料，准备自己的模板和来源说明。当前默认 promptFor 移植261版上游结构，不是任意图片库的通用提示词生成器。

由于数值库与设备可能造成浮点差异，替换运行环境后以重新生成的graph版本为准；分享链接携带旧图版本时明确告知不可重现，不悄悄沿用新图。
