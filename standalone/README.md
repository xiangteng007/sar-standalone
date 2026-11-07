# SAR 獨立私人演練版 v0.5

這套 Node.js 服務不依賴 ChatGPT Sites。內建 SQLite、私人附件目錄與 Google Identity Services 登入；目前為合成資料演練版，尚未完成真實 Google 登入及實體手機驗收，不可當正式指揮／派遣平台。

## 安裝

需要 Node.js 24.22.1 或更新的受支援版本。解壓至自有目錄，在此目錄執行 `npm ci`。依 `.env.example` 設定環境變數，再執行 `node --env-file=.env server.mjs`。不會自動建立公開網域或開放防火牆。

Google Cloud 必須配置 Web OAuth client，將 **完全一致的 SAR_ORIGIN** 設為 Authorized JavaScript origin；自有 HTTPS 網域及憑證由部署管理者設定。SAR_GOOGLE_ALLOWED_SUBJECTS 使用事先核准且驗證過的 Google `sub`，不是 email，不自動開放第一個登入者。僅知道 email 不足以配置 allowlist。不要將憑證、session 或真實個資交給聊天或提交 Git。

本機測試 origin 可用 `http://127.0.0.1:8787`；其他位址要求 HTTPS。預設僅綁 127.0.0.1，正式運行需自有 TLS 反向代理，保留符合 origin 的 Host，代理與 Node 僅在受控私人網路互通。存放資料的目錄不在 public 內。

## 資料與備份

`SAR_DATA_DIR` 下有 `sar.sqlite`、SQLite WAL 及 `media`。停止服務後一起備份整個資料目錄，再啟動；還原前保留現有副本，勿直接覆寫。照片及備份目前未加密，需由主機磁碟加密、帳號權限及備份政策保護。Linux 建目錄 0700／檔案 0600；Windows ACL 要在部署機另行驗證。合成停機還原演練已通過，不等於實際部署機、異地備份或災難復原已驗收。

### 停機維護工具

建置包附有 `recovery.mjs`，不讀取 `.env` 或 Google 憑證。先在服務自己的終端按 Ctrl+C，等待退出，確認沒有其他寫入者；再於部署目錄執行下列範例。範例假設資料在 `./sar-data`，管理者已建立受保護的 `../backups` 父目錄；請按實際設定替換路徑。相對路徑以本次命令的工作目錄為準，建議正式操作使用絕對路徑。

```sh
node recovery.mjs backup ./sar-data ../backups/snapshot-001 --stopped
node recovery.mjs verify ../backups/snapshot-001
node recovery.mjs restore ../backups/snapshot-001 ./sar-data-restored-001 --stopped
```

每次檢查 exit code：0 代表該操作成功，非 0 必須停止後續切換。備份與還原的目的目錄必須尚不存在，父目錄必須已存在；工具不覆寫既有目錄，不會自動切換服務、重啟或修改私人設定。`--stopped` 表示操作人已確認停機，不能取代這項確認。

- 備份取得資料鎖，只複製資料庫、存在的 WAL／SHM 及附件；核對複製前後 SHA256，再檢查副本 SQLite 完整性、外鍵及照片關聯。額外設定檔、殘留 `.part`、符號連結與硬連結會使備份失敗，不會默默略過。
- 驗證先核對清單與 SHA256，再使用拋棄式副本檢查 SQLite，不直接開啟封存備份。清單不是簽章；僅處理可信任的本機備份，不能當成來路不明資料的安全驗證。
- 還原只寫入新目錄，驗證檔案後清除還原副本的所有 session。原資料及備份保持原樣，案件狀態不被改成已核准或結案。還原後必須重新登入。
- 失敗可能留下新建立的部分目的目錄與 `.recovery-incomplete`；服務拒絕開啟這種目錄。保留供檢查，修正原因後改用另一個新目錄重試，不以移除標記強迫啟動。

服務與工具共用 `.sar-lock`，同一資料目錄不能同時啟動兩份本版服務或維護作業。這是合作式鎖：舊版本及外部 SQLite 工具不會遵守。正常關閉釋放鎖；斷電、強制終止或崩潰可能留下鎖。工具**不自動移除殘留鎖**。管理者必須先確認該目錄所有服務及維護程序均已停止、保存原目錄副本，才可人工處理殘留鎖並執行驗證；不能僅憑鎖的時間判斷沒有寫入者。

切換或回復版本時維持入口關閉，使用相容的程式版本與重新核准的設定，將 `SAR_DATA_DIR` 指向通過驗證的新還原目錄，先執行 `node launch.mjs check` 再啟動。不要直接重新開放含舊 session 的歷史資料目錄。核對附件、案件狀態、身分隔離及結案限制後才恢復入口；若失敗，保留原資料與候選目錄，停止切換。這不等於已完成真實登入或部署切換演練。

工具不加密備份、不保存部署秘密、不保證斷電原子性或異地／NAS 耐久性。備份和暫存副本都含私人資料，須保護主機、暫存磁碟、存取權限及保存期限；不得提交 Git。可重現測試：來源庫先 `npm run build`，再 `node tests/recovery-cli.mjs`，14 項使用臨時合成資料、實際 SQLite 與 CLI，結果寫入 `verification/recovery-cli.json`。

### 人工復原驗收檢查

以下保留為管理者核對程序；工具已自動完成其檔案清單、資料完整性與還原副本 session 清除步驟：

1. 暫停入口並停止服務，確認沒有寫入者；保存版本與設定的安全存放位置，不把秘密放入 Git 或報告。完整複製資料目錄並建立檔案清單、大小及 SHA256，包含仍存在的 WAL 檔案；清單與備份須受到同等存取保護。
2. 還原至全新私人目錄，保留原資料與備份。啟動前核對檔案清單與雜湊，缺少或變動的附件一律停止還原。SQLite integrity_check、foreign_key_check 及照片關聯檢查在拋棄式副本執行，不直接開啟封存備份；即使 readOnly 連線，WAL 模式也可能產生 sidecar 檔。
3. 在還原副本開放存取前，用受控 SQLite 管理連線執行 `DELETE FROM sar_sessions`，確認筆數為 0；備份可能含備份後才被登出的 session，不可直接恢復舊登入。重新核對當前核准 sub 白名單，再啟動並重新登入。不要讀出或保存 session token。
4. 核對案件與待審／核准／退回／結案狀態、附件下載 SHA256、核准匯出欄位、另一身分不可讀取、結案後不可寫入；重啟後再次核對。任一失敗維持入口關閉，保留原目錄供回復。

來源庫可重現命令：先 `node scripts/build-standalone.mjs`，再 `node tests/backup-restore.mjs`。僅建立臨時合成資料，8 組檢查結果寫入 `verification/backup-restore.json`；不讀既有資料或帳號。此測試使用實際 SQLite／檔案及 Request/Response runtime，Google verifier 為替身，並非 HTTP、TLS、NAS、斷電或真人登入演練。外部備份位置、保存期限、容量與 ACL 尚須部署時驗證。

重啟會保留案件／照片／有效 session；登入挑戰不保留，登入頁需重開。session 1 小時，登出撤銷；移除 allowlist 後重啟即停止該帳號存取。沒有預設管理者、測試後門或匿名 API。

## 功能與限制

點、線、面標記；照片 JPEG/PNG ≤5MB；位置人工核對；待審／核准／退回；僅匯出核准且符合類型的成果；結案停止收件、審核及成果匯出。地圖底圖與 Google 登入需連網。尚無 HEIC、EXIF GPS 擷取、GPX、離線補傳、自動判定「已排除」，沒有 OCR 自動精準定位的承諾。

本輪 HTTP 測試使用 synthetic Google claims；Google signature 測試使用官方 library 與測試 RSA 憑證。均不能取代實際 Google 帳號及外部網路完整登入測試。

## v0.5 送件與手機可靠性

定位錯誤會清除舊結果；定位選取期限為兩分鐘，切入背景需重新取得。送件有 30 秒回執逾時，未知結果保留原始內容於當前頁面，可核對清單或以原編號去重重試；不自動補傳，也沒有永久離線草稿。已收件但清單刷新失敗不會被誤報為未收件。清除本頁草稿不撤回伺服器回報。已加入起訖時間與超過 24 小時提醒。測試範圍見根目錄 `README.md` 與 `tests/`，仍非正式救援系統。

## 啟動前設定預檢

執行 `node --env-file=.env server.mjs --check-config`：只讀取必要設定與路徑，不建立資料庫、不監聽、不連 Google。錯誤只輸出固定代碼及 exit 1；通過也不代表 client 已獲 Google 核准或 sub 已經驗證。正式啟動使用相同檢查。

SAR_ORIGIN 必須為完整 origin（無路徑、尾斜線、帳密或查詢），非 loopback 要 HTTPS；本機 HTTP 的 port 必須對上 SAR_PORT（1–65535）。綁定位址限 localhost／127.0.0.1／::1，外部 TLS 經受控反向代理。白名單不可為空、email、萬用字元、重複或範例佔位字；實際 sub 必須另外核准，程式不猜測。資料目錄不得在 public 內、是 public 的上層或經符號連結落入 public。這是啟動前路徑檢查，部署目錄必須由可信任管理者控制，不能取代 ACL。

預檢不驗證 Google Cloud 遠端設定、TLS 憑證、DNS、防火牆、磁碟容量或實際寫入權限；這些仍須部署驗收。啟動時儲存與監聽錯誤輸出通用代碼，不列印原始設定或檔案路徑。可重現測例為來源庫 `tests/deployment-config.mjs`。

## 統一啟動入口（Windows／Linux）

Linux 常駐 VM 的 systemd 範本、主機路徑與權限、正常停機／故障處理及更新回復順序見 [deploy/README.md](deploy/README.md)。範本不會自動啟用，實際服務管理與開機驗收仍需在部署機完成。

部署目錄安裝套件並建立私人 `.env` 後，可使用：

- Windows：`START-SAR.cmd check` 預檢，`START-SAR.cmd start` 啟動。
- Linux：`sh start-sar.sh check` 預檢，`sh start-sar.sh start` 啟動。
- 跨平台：`node launch.mjs check` 或 `node launch.mjs start`。

相對資料路徑會以部署目錄為基準，避免捷徑的工作目錄不同導致建立第二份資料庫。`.env` 必須存在；不會自動將範例複製成可登入設定。既有程序環境變數優先於 `.env`，管理者應清除過期的 `SAR_` 設定再啟動。可設定 `SAR_NODE_EXE` 指向受信任 portable Node；不更改系統 Node 或自動安裝服務。

入口在前景執行，停止時在該終端按 Ctrl+C，等待程序退出才備份；不提供依連接埠掃描或殺除未知程序。這不是開機自動啟動、背景服務管理或持續運行驗收。正式部署仍須配置受控的程序管理與 TLS，並驗證關閉及重啟。
