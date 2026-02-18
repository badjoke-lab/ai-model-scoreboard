# Release Checklist (AIMS / free ops)

## Scope
- [ ] この手順は **PR#155 に積む方式** を前提にする。
- [ ] 無料運営を優先し、**外部 fetch を増やさない** 方針を守る。
- [ ] v4 生成物（例: `public/data/v4`）は、手元で再生成しても **コミットしない**。

## Preconditions (must hold)
- [ ] Node / pnpm 前提を満たす（`package.json` に `engines` が無い場合は **Node 20 系 + pnpm** を推奨）。
- [ ] 作業は `main` 直ではなく、feature ブランチ（または `codex/*`）で行う。
- [ ] `docs/task01-56.md` は運用メモ（CI/PR 対象外）として扱い、触らない。

## Before merge (local)
- [ ] 下記コマンドをローカルで実行する。

```bash
pnpm -s typecheck
pnpm -s build
pnpm -s test
```

- [ ] `pnpm dev -p 5001` など 5000 番台で起動し、以下を確認する。
  - [ ] `/models/[modelKey]`（override ありのモデル）
  - [ ] `/models/[modelKey]`（override なしのモデル）
  - [ ] `debug-text` がある場合: `/models/[modelKey]?debug-text=1`
- [ ] `Next.js catch-all must be last` が出たら、同一階層で catch-all ルートより後ろに静的/動的ルートを置いていないか確認する。

## Before merge (CI / PR)
- [ ] CI で以下が緑であること。
  - [ ] typecheck / build
  - [ ] snapshot test（T29 導入後）
  - [ ] validate overrides（T27）
  - [ ] validate maps（T47R）
- [ ] PR 本文に次のテンプレを入れて確認する。

```md
## Release checks
- [ ] local: `pnpm -s typecheck`
- [ ] local: `pnpm -s build`
- [ ] local: `pnpm -s test`（ある場合）
- [ ] CI: typecheck/build 緑
- [ ] CI: snapshot test（T29）
- [ ] CI: validate overrides（T27）
- [ ] CI: validate maps（T47R）
- [ ] v4 generated files (`public/data/v4` など) をコミットしていない
```

## Merge rules
- [ ] squash / rebase / merge はどれでも可。ただし **1PR=1目的、コミットは意味単位** を守る。
- [ ] **自動整形だけのコミットを混ぜない**（機能変更と分離する）。
- [ ] v4 生成物（`public/data/v4` など）をコミットしない。

## After merge (deploy smoke)
- [ ] モデル詳細ページがクラッシュせず表示される。
- [ ] Evidence 4タイプが常に表示される。
- [ ] Links が表示される。
- [ ] Raw Inputs が折りたたみで開ける。
- [ ] `withheld` / `specMissingEvidence` 表示が崩れていない。

## Rollback / revert rules
- [ ] 壊れた場合は最優先で revert する（無料運営では復旧コストが高いため）。
- [ ] revert 判断基準の例:
  - [ ] build 失敗
  - [ ] 詳細ページクラッシュ
  - [ ] CI 赤（必須ジョブ）

## Notes (what we intentionally do NOT do)
- [ ] UI でのスコア再計算はしない。
- [ ] audit は自動 OK にしない（manual only）。
- [ ] 推測で `official_page` を OK にしない（map / override のみ）。
