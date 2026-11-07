# Linux 單機部署與維護

這是待部署驗收的 systemd 範本，不會自動安裝、啟用服務、開通雲端或變更防火牆。適用常駐 Linux VM；目前仍須真 Google、HTTPS 與手機驗收。單機不是高可用，NAS 備份不是即時備援。

## 部署佈局

由部署管理者在已核准主機準備以下路徑：

| 路徑 | 用途與權限 |
| --- | --- |
| `/opt/sar/node/bin/node` | 受信任 Node.js 24.22.1 以上執行檔；root 擁有、服務帳號不可修改 |
| `/opt/sar/releases/<version>` | 建置包及 `npm ci --omit=dev` 的套件；root 擁有，sar 可讀不可寫 |
| `/opt/sar/current` | 指向選定版本；只在停機後由管理者切換 |
| `/etc/sar/sar.env` | 私人設定，root:sar、0640；父目錄 root:sar、0750 |
| `/var/lib/sar/data` | 同機持久磁碟上的 SQLite 與附件；sar:sar、0700 |

建立專用、無互動登入的 `sar` 系統帳號。不要把整份程式、node_modules 或 Node 執行檔交給服務帳號寫入。資料磁碟若另掛載，須在服務啟動前確認正確掛載，並為 unit 加入適當 `RequiresMountsFor=`；不能讓掛載失敗時改寫系統碟中的同名空目錄。

私人設定依 `.env.example` 填入真正 HTTPS origin、Google Web client 與事先核准的 verified sub。本範本由 Node 直接讀取 `/etc/sar/sar.env`，不經 `launch.mjs`，所以不另要求部署根的 `.env`。unit 固定 bind、port 及資料目錄，這三個 Environment 值優先於 env-file；更改它們時須同步更新代理、備份及驗收路徑。

## 安裝與驗收順序

1. 主機、計費、網域及網路規則經核准後才配置。台灣主站選 `asia-east1`；資料使用持久磁碟，備份／快照／日誌位置另核對，不把 VM 區域當所有外部服務的資料所在地保證。
2. 完成以上帳號、路徑及私人設定。先以 sar 身分執行 Node 設定預檢，傳入與 unit 相同的三個環境變數；不得印出私人設定或憑證。預檢只驗語法及路徑。
3. 將此 unit 安裝至 `/etc/systemd/system/sar.service`，執行 `systemd-analyze verify /etc/systemd/system/sar.service`，再 `systemctl daemon-reload`。任何 unknown directive、路徑或權限錯誤先處理。
4. 先 `systemctl start sar`，確認 `systemctl is-active sar`、本機 health 及匿名 API 拒絕。`Type=exec`／active 只代表程序已啟動，不能當應用健康或 Google 登入成功。
5. 使用同機 HTTPS 反向代理轉送至 `127.0.0.1:8787`，保留與 SAR_ORIGIN 一致的 Host（非預設 port 時包含 port）；憑證及 DNS 須有效。不要直接公開 8787、資料目錄或設定檔。私人驗收入口另配置已核准的存取限制；Google 帳號 allowlist 只保護應用資料，不代表整個首頁不可見。
6. 實測真登入／另一身分隔離、照片及點線面、匯出、合成案件結案；確認代理不快取私人 API／附件、不記錄 cookie／Authorization／request body，限制請求大小且仍容許 5MB 圖片與 multipart 開銷。
7. 確認正常停止釋放 `.sar-lock`、重啟保留資料與附件，再啟用 `systemctl enable sar` 並安排受控重開機驗收。此步會變更主機開機行為，僅在核准部署機執行。

## 故障與停機

`Restart=on-failure` 每次相隔 10 秒，120 秒內最多 3 次啟動；錯誤設定或資料鎖不會無限重試。崩潰／強制終止可能留下鎖，因此不能承諾每次故障都自動復原。絕不使用 ExecStartPre 刪鎖或自動略過完整性檢查。先查固定錯誤代碼，確認所有寫入者停止並保存副本，再依主 README 的鎖處理與還原規則操作。原因排除後才 `systemctl reset-failed sar` 與 `systemctl start sar`。

維護時關閉外部入口，執行 `systemctl stop sar` 並確認 inactive、MainPID=0；人工停止不觸發 Restart。若超過 60 秒，systemd 可強制結束，須檢查停止結果與鎖，不能當正常關閉。備份用同一 sar 身分與絕對資料路徑執行 `recovery.mjs`，備份目的地放該帳號可寫的受保護目錄；成功 verify 後才送至 NAS。現有工具需停機，不是線上備份，也沒有加密／NAS 實測保證。

更新時保存舊版本與設定，停止服務、備份、驗證，再切換 current；先預檢及私人驗收才恢復入口。需要還原資料時只 restore 至新目錄，依主 README 撤銷舊 session、更新 unit 的資料路徑、daemon-reload，再驗證；不得直接覆寫原資料或未查 schema 相容性就切回舊程式。

## 上線前尚須完成

- 指定實際 VM／磁碟／IPv4／流量／備份的月費，設用量警示；預算通知不是費用硬上限。
- 驗證磁碟容量告警、更新窗口、備份保存與還原時間；不要自動刪除未知資料釋放容量。
- 完成真 Google、代理 TLS、開機自啟及主機服務帳號的實際寫入隔離測試。
- 完成手機 GPS 允許／拒絕、相機、背景及斷網回執；本文件不能取代實機。

官方參考：[systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)、[systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)、[Google Cloud 區域](https://docs.cloud.google.com/compute/docs/regions-zones)、[NGINX 代理設定](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)。
