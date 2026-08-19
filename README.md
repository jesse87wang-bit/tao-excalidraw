# tao-excalidraw

把中文短视频口播稿转成可编辑的 Excalidraw 信息图长图，并为每个自然段配置统一风格的稚拙签字笔和彩铅插画。

Turn Chinese short-video scripts into editable Excalidraw infographics with a consistent hand-drawn illustration for each narrative section.

## 安装 / Install

推荐使用交互式全局安装。安装器会检测本机已有的 Agent，并让你选择目标：

```bash
npx skills add jesse87wang-bit/tao-excalidraw --skill tao-excalidraw --global
```

安装到所有受支持的 Agent：

```bash
npx skills add jesse87wang-bit/tao-excalidraw --skill tao-excalidraw --global --agent '*' --yes
```

只安装到指定 Agent：

```bash
npx skills add jesse87wang-bit/tao-excalidraw --skill tao-excalidraw --global --agent codex --agent claude-code
```

更新已安装版本：

```bash
npx skills update tao-excalidraw --global
```

## 使用 / Usage

在新的 Agent 会话中直接说：

```text
请加载并严格使用 tao-excalidraw 处理下面的中文口播稿：

……
```

支持显式 Skill 调用的 Agent 也可以使用：

```text
用 $tao-excalidraw 处理下面的稿子：……
```

Skill 会严格执行三个阶段：

1. 先提交逐段绘制逻辑，不生图；
2. 逻辑确认后，单独确认本轮所有分段的统一成品尺寸；
3. 逻辑和尺寸都确认后，才生成插画、Excalidraw、完整长图、手机预览和 ZIP。

## 运行要求 / Requirements

- 支持 Agent Skills／`SKILL.md` 的 Agent；
- Node.js 18 或更高版本，用于运行布局校验器；
- 若要完成正式绘制阶段，宿主还需具备等价的参考图生图、图像查看、Excalidraw 构建与渲染、文件打包能力。

安装 Skill 不会自动为宿主增加生图或渲染工具。缺少能力时，Skill 会明确说明缺口，并请求用户提供素材、启用等价工具，或授权交付可完成的部分。

## 仓库结构 / Repository layout

```text
skills/tao-excalidraw/
├── SKILL.md
├── agents/openai.yaml
├── assets/
├── references/
└── scripts/
```

`SKILL.md` 是通用入口；`agents/openai.yaml` 只提供 OpenAI 客户端的可选界面元数据，其他 Agent 可以忽略。

## 发布验证 / Validation

```bash
node scripts/validate-release.mjs
```

该检查会验证 Skill 结构、必需资源、脚本语法、文件权限风险、私有目录和常见敏感信息模式。

## 示例资产 / Example assets

仓库随 Skill 分发统一画风锚点和一张完整 FDE 长图示例，用于帮助 Agent 理解版式、信息密度和插画风格。这些资产与代码、文档一起采用 MIT 许可证。

## 许可证 / License

[MIT](LICENSE)。仓库内的代码、文档和图片资产均适用该许可证。

tao-excalidraw 是独立社区项目，与 Excalidraw 官方没有隶属或背书关系。
