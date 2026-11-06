import {HeartHandshake,ShieldCheck,CloudSun,Users,Backpack,MapPin,Phone} from 'lucide-react';

export function ParticipationNotice(){
 const items=[
  {Icon:ShieldCheck,title:'先確認任務',text:'確認案件仍需協尋、分工與回報窗口。山林搜救依正式協調行動，不自行組隊闖入未知區域。'},
  {Icon:CloudSun,title:'看天氣，也看體力',text:'出發前查天氣與封閉公告；颱風、豪雨或身體不適時取消。設定折返時間，情況不安全就停止。'},
  {Icon:Users,title:'結伴，留下行程',text:'讓可信任的留守者知道路線、同伴與預計返回時間。保持聯繫，不脫隊、不走未確認的捷徑。'},
  {Icon:Backpack,title:'裝備與電量備妥',text:'準備飲水、食物、雨具、保暖衣物、照明、基本急救用品與備用電源；先熟悉定位及離線地圖。'},
  {Icon:MapPin,title:'安全與隱私有界線',text:'只在合法可達的區域活動；不擅入私地、不涉險。人員線索交警方或正式窗口，不公開個資或推測行蹤。'},
  {Icon:HeartHandshake,title:'動物協尋，保持耐心',text:'先與飼主或救援窗口核對特徵；保持安全距離，不追逐、圍堵或自行冒險捕捉。只回報已確認的觀察。'},
 ];
 return <section className="participation" aria-label="協尋感謝與行前須知">
  <div className="thanks"><HeartHandshake size={23}/><div><span className="eyebrow">THANK YOU FOR CARING</span><h1>謝謝你，願意為每一份牽掛多走一步。</h1><p>每一筆清楚的回報，都能幫助協調者減少重複、掌握進度。請先照顧自己，再把關心化為安全的行動。</p></div></div>
  <div className="practice-note"><b>目前是私人演練</b><span>以下為模擬協作的行前提醒，並非出勤通知；請只填模擬資料。</span></div>
  <details className="safety-details"><summary><span><ShieldCheck size={19}/>行前須知與安全提醒</span><span className="summary-hint">出發前請逐項確認</span></summary>
   <div className="safety-grid">{items.map(({Icon,title,text})=><article key={title}><Icon size={20}/><div><h2>{title}</h2><p>{text}</p></div></article>)}</div>
   <p className="emergency"><Phone size={18}/><span><b>緊急狀況不要等平台回覆。</b>在臺灣遇人身危險或山域事故，請撥 119；需警方協助請撥 110，說明位置與狀況。本平台沒有值勤派遣功能。</span></p>
   <div className="notice-sources">安全建議參考 <a href="https://www.nfa.gov.tw/pro/index.php?article_id=470&code=list&flag=detail&ids=484" target="_blank" rel="noreferrer">消防署行前注意事項</a>、<a href="https://www.nfa.gov.tw/cht/index.php?article_id=18935&code=list&flag=detail&ids=1468" target="_blank" rel="noreferrer">山域活動安全宣導</a>；動物段落為本平台的保守協作提醒。查核：2026-11-05。</div>
  </details>
 </section>;
}

export function LegalNotice({authLabel="Google"}:{authLabel?:string}){return <footer className="legal" id="legal">
 <div className="legal-heading"><ShieldCheck size={20}/><h2>法律聲明與使用界線</h2><span>私人演練版 · 2026-11-05</span></div>
 <p className="legal-lead">本平台供協作流程測試與資訊整理，不是官方搜救、報案、即時定位或派遣服務。曾搜尋不代表已排除，地圖也不代表道路安全或可以通行。</p>
 <div className="legal-grid">
  <section><h3>資料與行動</h3><p>回報、照片、GPS 與底圖可能有誤差、缺漏或過時；審核不等於官方認證。請依現場狀況、官方公告及正式協調決定行動，不擅闖、不追蹤圍堵，也不以此平台取代求救。</p></section>
  <section><h3>隱私與照片權利</h3><p>目前只接受模擬資料，請勿上傳真實人員線索、住址、病史或其他敏感資訊。上傳者須有提供照片與內容的權利；不得假借協尋侵害他人隱私。位置需本人核對，原圖不會自動移除 EXIF。</p></section>
  <section><h3>存取、結案與更正</h3><p>本版僅允許事先核准的帳號登入，各帳號資料分開存取。結案停止新增、審核變更及成果匯出，私人紀錄仍保留，不代表資料已刪除。本版未提供對外申訴、資料刪除或自動到期功能；正式對外啟用前須補齊可用聯絡窗口、保留期限及權利行使程序。</p></section>
  <section><h3>依法保留的責任</h3><p>本聲明用於說明服務範圍，不排除或限制依法不得免除的責任；故意或重大過失之責任不得預先免除，亦不限制當事人依法享有的權利。文案尚未經個案法律審閱，不能視為全面免責或使用者放棄權利。</p></section>
 </div>
 <details className="legal-details"><summary>參考法規與測試限制</summary><p>本版使用 {authLabel} 登入；真實登入、多帳號、手機離線、HEIC 與影像去識別化尚未驗收。未送出的內容不會自動保存。第三方底圖請求會包含所瀏覽的圖幅位置；底圖需連網。</p><p>法規參考：<a href="https://mojlaw.moj.gov.tw/LawContentExtent.aspx?LSID=FL001351&LawNo=222" target="_blank" rel="noreferrer">民法第 222 條</a>、<a href="https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=I0050021" target="_blank" rel="noreferrer">個人資料保護法（含第 3、5、11 條）</a>。實際適用仍依當時有效法規與個案判斷。</p></details>
 </footer>;}
