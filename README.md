# Lumorphia website

`https://lumorphia.com/` 向けの公式サイト。採用したデザインを HTML・CSS・JavaScript の静的サイトとして実装している。
Prismtone と準備中の Scenote を紹介し、Lumorphia アカウントへ案内する。

## 開発

Node.js 24.21 以上。外部パッケージのインストールは不要。

```sh
npm run dev
```

`http://127.0.0.1:3200` を開く。編集後はブラウザを再読み込みする。
ポートを変える場合は `PORT=3201 npm run dev`。

## 検査・ビルド

```sh
npm run check
npm test
npm run build
npm run preview
```

ビルドは `dist/` を生成する。CSS・JavaScript に内容から決めたファイル名を付け、更新時に古いキャッシュを使わないようにする。
HTML、公開用素材、フォントライセンス、robots.txt、sitemap.xml だけを出力する。
`previews/`、`docs/`、スクリプト、README は公開用出力に含めない。
`preview` は `dist/` を `http://127.0.0.1:3200` で配信する。

## テーマ

初回は端末の設定に合わせ、ボタンで選んだライト／ダークを `localStorage` の `lumorphia-theme` に記憶する。
保存できない環境でも切り替えは動く。手動で選んでいない間は、端末のテーマ変更に追従する。
`?theme=light` / `?theme=dark` は確認用の一時的な指定で、保存済みの設定を書き換えない。

## 配信

`dist/` の内容を静的ホスティングの公開ルートへ配置する。公開URLは `https://lumorphia.com/`。
存在しないURLは `404.html` をHTTP 404で返すように設定する。トップページへのSPAフォールバックは不要。
HTMLは再検証、ハッシュ付きCSS・JavaScriptは長期キャッシュ、固定名の画像は短期キャッシュにする。
プレビュー用サーバーは本番運用向けではない。

推奨するレスポンスヘッダー（プレビューにも設定済み）：

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src https://accounts.lumorphia.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.lumorphia.com
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

配信は Cloudflare Workers の静的アセット (Workers Builds)。本番ブランチは `main`、デプロイコマンドは `npx wrangler deploy`。
`wrangler.jsonc` がデプロイの前に `npm run build` を回し、`dist` だけを上げる。存在しない URL は `404.html` を 404 で返し、`dist/_headers` もそのまま効く。

Accounts を一般に開くまでは、ビルドがログインとアカウント管理の入口 (`data-accounts-entry`) を `hidden` にし、
`lumorphia-accounts-origin` を空にして `account.js` がセッションを見に行かないようにする。
開くときは Workers Builds のビルドの環境変数 `LUMORPHIA_ACCOUNTS_OPEN=1` を設定してビルドし直す。
`npm run dev` はビルドを通さないので、手元と Accounts の E2E では入口が常に見える。

## デザイン・素材

[デザインと素材の出典](docs/design.md)に既存ロゴ、スクリーンショット、FFXIVの権利表記の根拠を記録している。
試作・確認画像は `previews/` に保管する。FFXIV画像と提供ロゴの権利は、それぞれの権利者に帰属する。

## アカウントの導線

ヘッダーは未ログインならログインリンク、ログイン中ならアイコンと表示名のメニューを表示する。スマートフォンではアイコンだけを表示する。トップには「Lumorphiaトップ」を置かず、アカウント管理とログアウトを案内する。

`account.js` は Accounts の `/api/website/session` に credentials 付きで接続する。取得するのはヘッダーに必要な表示名・ユーザーID・アイコンのみ。セッション情報はローカルストレージに保存しない。Accounts が停止している場合もトップは表示し、通常のログインリンクを残す。

本番では Accounts の `WEBSITE_ORIGIN=https://lumorphia.com` と、トップのメタタグ `lumorphia-accounts-origin=https://accounts.lumorphia.com` を対応させる。ログアウトは Accounts の `/logout` へPOSTしてトップへ戻る。上のCSPはリダイレクト先の自サイトも form-action に含める。

手元でAccountsと接続する場合は、トップもHTTPSかつAccountsと同じサイトのホストで動かす。`scripts/serve.mjs` は `ACCOUNTS_ORIGIN`、`DEV_TLS_CERT`、`DEV_TLS_KEY` に対応する。`ACCOUNTS_ORIGIN` はプレビューのHTMLとCSPに反映するが、ビルド済みHTMLの本番URLは変更しない。トップのオリジンをAccountsの `WEBSITE_ORIGIN` に設定し、ホストに合う手元の証明書・名前解決を用意する。

両サイトの実際の接続は Accounts の `pnpm e2e` で確認できる。E2E用DB、TLS、ローカルのOAuthモックを使用する。
