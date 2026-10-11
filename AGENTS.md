# Image Recipes

- 先读 README、CONTRIBUTING、SECURITY 与 CHANGELOG。Node.js 22+，原生 ESM，零第三方运行依赖。
- src 是纯规格/图片头/ZIP 模块；web 负责 Canvas 与交互，bin 仅提供回环地址静态服务；examples 只收自制合成素材。
- 输入按字节识别，解码前检查尺寸/动画与限制；文件头检查不是完整安全审计。真实浏览器验证编码，不能默默伪装降级格式。
- 保持比例、不裁切、默认不放大；超限和部分失败必须明确提示；不覆盖/上传/持久保存素材。只保存规格。
- 安全 DOM 使用 textContent；ZIP 名称拒绝路径、保留名与重复；处理顺序、位图/画布/URL 释放需要检查。
- 改行为先补回归测试，运行 npm test、npm run check、git diff --check；更新 CHANGELOG 和相关边界说明。
- 本项目独立 Git；不收账号定位、私人选题/计划、真实客户素材或凭据。提交前核对 Git 根和 remote。
- SemVer、约定式提交、短期 codex/ 分支、PR 审查；禁止直接推 main、强推和移动已发布标签。AI 审查不能冒充 GitHub 批准，不把本地验证当作 CI。
