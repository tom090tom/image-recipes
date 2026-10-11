# Changelog

遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 和 [SemVer](https://semver.org/)。

## [Unreleased]

## [0.1.0] - 2026-10-11

### Added

- 浏览器本机 JPEG/PNG/静态 WebP 批量缩放、质量设置、统一命名和 ZIP 导出。
- 最多 5 条导出规格的配方编辑、保存与清除；原图不上传、不保存、不覆盖。
- 保持比例居中留白、默认不放大，透明背景规则及大小超限/失败提示。
- 图片头/尺寸/动画检查、批次与输出限制、ZIP 文件名保护、本地服务访问边界。
- 3 张合成示例、37 项自动测试、浏览器验证与独立 ZIP/图片检查，固定序号前缀避免名称组合碰撞。
- MIT 许可证、安全/免责说明、SemVer/约定式提交/PR 规范、Issue/PR 模板与 CI 模板。

### Limitations

- 首版无动画、RAW、裁切、平台规则同步或图片处理 CLI；超限仅提示，不保证上传达标。
- 浏览器重新编码可能改变色彩、画质和元数据；不提供独立安全审计或匿名化保证。
- CI 模板尚未启用，当前凭据缺少 `workflow` 权限。

[Unreleased]: https://github.com/tom090tom/image-recipes/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tom090tom/image-recipes/releases/tag/v0.1.0
