# 贡献与 Git 维护规范

1. 用 Issue 描述真实问题，复现只用有权公开的合成/脱敏素材；小修复可直接 PR，漏洞走 [私密渠道](SECURITY.md)。
2. 从最新 `main` 建短期分支：维护者 `codex/<主题>`，外部贡献者 `feat/<主题>`、`fix/<主题>` 或 `docs/<主题>`。一个 PR 解决一个清楚的问题。
3. 行为变更先添加回归测试。运行 `npm test`、`npm run check`、`git diff --check`，记录实际平台和结果；涉及 Canvas 的变更验证真实解码、输出格式/尺寸、透明背景、失败路径与内存释放。
4. 使用 PR 模板。检查图片输入边界、ZIP 名称、隐私、不覆盖原图、配方兼容性及文档一致性。
5. 发布后 `main` 要求 PR、1 名具备写权限的独立审查者批准、过期批准失效、讨论解决及线性历史；管理员也受保护，禁止直接推送、强推或删除。只允许 Squash merge，合并后自动删工作分支。
6. AI 本地审查不是 GitHub Approve，作者不能批准自己的 PR；单人维护需要先安排真实独立审查者，不能伪造批准。

## 提交与版本

遵循 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)：`feat(recipe): add named export presets`、`fix(zip): reject unsafe archive paths`。类型：feat、fix、docs、test、refactor、perf、build、ci、chore、revert；scope 可选。破坏性变更使用 `!` 或 `BREAKING CHANGE:` 并说明迁移。PR 评审检查最终 Squash 标题，首版没有自动消息校验器。

[SemVer](https://semver.org/)：早期 `0.x` 修复提升 PATCH，功能或破坏性变化提升 MINOR；从 `1.0.0` 起按兼容修复/兼容功能/破坏性变化分别提升 PATCH/MINOR/MAJOR。共享模块接口、配方存储结构、缩放与命名规则都是需要记录的接口。

用户可见变化写入 [CHANGELOG](CHANGELOG.md) 的 Unreleased；发布 PR 同步 package.json、package-lock.json 与 CHANGELOG。`private: true` 仅防止误发 npm。在已审查合并的提交上创建注解标签 `vX.Y.Z`，同版 Release 引用 CHANGELOG；已发布标签不移动，错误用后续补丁修正。PR → 合并提交 → 标签 → Release 可追溯。

发布前验证许可证、测试、图片边界与历史，私密管理资料和未授权素材不可进入产品仓库。当前凭据无 `workflow` 权限，CI 未启用，[模板](docs/ci-template.yml) 仅供后续启用；不能把本地测试写成 CI 通过，也不设置虚假的必需状态检查。
