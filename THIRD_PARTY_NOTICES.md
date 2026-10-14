# 来源、版本与许可

## 原创部分

前端交互、图数据构建工具、实验对照与原创说明采用根目录 MIT LICENSE。头像的可许可部分采用 ASSET_LICENSE.md 中的 CC BY 4.0。

## 上游画风资料、模板与参考图片

来源：[yang0/handraw-style](https://github.com/yang0/handraw-style)。请保留作者 **yang0**、原仓库地址及上游许可声明。

图片编号、名称、参考作者、traits以及提示词模板固定于版本：

`58dee6151874c6fc381e6a0d97430f1c275c1696`

模板依据：[该版本 prompt_style.py](https://github.com/yang0/handraw-style/blob/58dee6151874c6fc381e6a0d97430f1c275c1696/handdraw-style-prompter/scripts/prompt_style.py)。不将它描述为每张头像当时实际使用的原始提示词。主题由使用者提供，本项目不自动扩写或翻译主题。

上游当前 master 提供 MIT LICENSE，并在README说明欢迎使用、修改和商业化以及保留作者与来源。保存的上游许可见 `data/handraw-style-LICENSE`。固定旧commit的根LICENSE未取得，当前许可声明与旧素材来源分别留证；这不是每张参考作品完整权利链的独立核实。MIT代码许可不扩大参考作品的第三方权利。

`assets/references/` 为已有项目使用的上游参考图转换副本。046号参考图根据上游联系表重新裁切，修复来源、区域与哈希记录在 `data/manifest.json`；不宣称所有参考图都是未经处理的上游原文件。

## 视觉特征模型

- [DINOv2](https://github.com/facebookresearch/dinov2)：标准模型及代码采用 Apache-2.0。正式图数据由 ViT-S/14 图像特征构建。模型不随本仓库分发。
- [OpenCLIP](https://github.com/mlfoundations/open_clip)：代码MIT；对照使用 [LAION ViT-B/32 指定权重](https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K)，模型卡标MIT。其他权重不自动继承这项核查。
- 固定代码revision、权重revision和文件哈希见 `research/model-lock.json`。原模型的行为和限制不由本项目保证。

## 交互灵感

本项目受到 Google Arts & Culture 的 [X Degrees of Separation](https://experiments.withgoogle.com/x-degrees-of-separation) 启发，机制参考作者公开的图像近邻与寻路说明。本项目自行实现界面与算法，未复制Google网站源码，未使用Google馆藏图片或其模型接口，也不与Google存在官方关联。
