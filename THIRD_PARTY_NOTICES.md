# 来源、版本与许可

## 原创部分

前端交互、图数据构建工具、实验对照与原创说明采用根目录 MIT LICENSE。头像的可许可部分采用 ASSET_LICENSE.md 中的 CC BY 4.0。

## 上游画风资料、模板与参考图片

画风资料基础来源：[yang0/handraw-style](https://github.com/yang0/handraw-style)。保留作者 **yang0**、原仓库地址及上游开源许可声明（MIT License，详细许可保存在 `data/handraw-style-LICENSE`）。

本项目收录并整理了当前 330 种画风，包含公开画风编号、名称、视觉特征描述与提示词规则：
- **提示词生成逻辑**：移植并适配自上游开源提示词工程与模型规则，支持按不同图像模型输出对应的纯图提示词；主题由使用者自行输入，不自动扩写或翻译。
- **画风参考图片**：`assets/references/` 中的 330 张参考图转换自上游开源仓库，用于在 Web 端直观展示画风视觉基准与下载对照。


## 视觉特征模型

- [DINOv2](https://github.com/facebookresearch/dinov2)：标准模型及代码采用 Apache-2.0。正式图数据由 ViT-S/14 图像特征构建。模型不随本仓库分发。
- [OpenCLIP](https://github.com/mlfoundations/open_clip)：代码MIT；对照使用 [LAION ViT-B/32 指定权重](https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K)，模型卡标MIT。其他权重不自动继承这项核查。
- 固定代码revision、权重revision和文件哈希见 `research/model-lock.json`。原模型的行为和限制不由本项目保证。

## 交互灵感

本项目受到 Google Arts & Culture 的 [X Degrees of Separation](https://experiments.withgoogle.com/x-degrees-of-separation) 启发，机制参考作者公开的图像近邻与寻路说明。本项目自行实现界面与算法，未复制Google网站源码，未使用Google馆藏图片或其模型接口，也不与Google存在官方关联。
