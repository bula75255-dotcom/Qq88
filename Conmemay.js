// ==UserScript==
// @name         QQ88 Auto Register v2.5
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Auto register + auto add bank QQ88 — textNode click fix
// @author       Onyx
// @match        *://2006666.com/*
// @match        *://www.2006666.com/*
// @match        *://qq88q.online/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const FIXED_PASSWORD    = 'tanthu123';
    const WITHDRAW_PASSWORD = '123456';
    const BRANCH            = 'Hcm';

    const BANKS = [
        'AB BANK','ACB BANK','AGRIBANK','ANZ BANK','BAC A BANK','BAO VIET BANK',
        'BIDV BANK','BVBANK','CAKE','CB BANK','CIMB BANK','CITI','CO OPBANK',
        'DBS','EXIMBANK','GP BANK','HD BANK','HNB','HONGLEONG BANK','HSBC',
        'IBK','IVB','KBANK','KIENLONGBANK','KOOKMI','LIOBANK','LIENVIET BANK',
        'MAFC','MBBANK','MBV','MSB BANK','NAMA BANK','NCB','NHB','OCB BANK',
        'PGBANK','PUBLICBANK','PVCOMBANK','SACOMBANK','SAIGONBANK','SCB','SCBVL',
        'SEABANK','SHB BANK','SHINHAN BANK VN','TECHCOMBANK','TIMO BANK','TPBANK',
        'UBANK','UOB','VDB','VIB BANK','VIETA BANK','VIETBANK','VIETCOMBANK',
        'VIETINBANK','VIKKI BANK','VPBANK','VIETNAM BANK FOR SOCIAL POLICIES'
    ];

    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randomPhone() {
        const p = ['09','08','07','03'][randInt(0,3)];
        let n = p;
        for (let i = 0; i < 8; i++) n += randInt(0,9);
        return n;
    }
    function randomUsername() {
        const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let u = 'u';
        for (let i = 0; i < 10; i++) u += c[randInt(0, c.length-1)];
        return u;
    }
    function randomAccNum() {
        let n = '';
        for (let i = 0; i < 10; i++) n += randInt(0,9);
        return n;
    }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function norm(s) { return s.replace(/\s+/g,' ').trim().toUpperCase(); }

    function setNV(el, val) {
        try {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(el, val);
        } catch(e) { el.value = val; }
        el.dispatchEvent(new Event('input',  {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        el.dispatchEvent(new Event('blur',   {bubbles:true}));
    }

    function isRed(color) {
        const m = color.match(/\d+/g);
        if (!m || m.length < 3) return false;
        return +m[0] > 150 && +m[1] < 100 && +m[2] < 100;
    }
    function isBlue(color) {
        const m = color.match(/\d+/g);
        if (!m || m.length < 3) return false;
        return +m[2] > 150 && +m[0] < 150 && +m[1] < 150;
    }

    function isInViewport(el) {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0
            && r.top  < window.innerHeight && r.bottom  > 0
            && r.left < window.innerWidth  && r.right > 0;
    }

    function saveAcc(acc) {
        let list = GM_getValue('q88_accs', []);
        list.push(acc);
        GM_setValue('q88_accs', list);
    }
    function getAccs() { return GM_getValue('q88_accs', []); }

    // ─── CLICK ENGINE ─────────────────────────────────────────
    function fireClick(el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;

        // Touch — mobile Safari
        try {
            const t = new Touch({
                identifier: Date.now(), target: el,
                clientX: cx, clientY: cy,
                radiusX:1, radiusY:1, rotationAngle:0, force:1
            });
            el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]}));
            el.dispatchEvent(new TouchEvent('touchend',  {bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[t]}));
        } catch(e){}

        // Pointer + Mouse
        for (const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
            el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
        }
    }

    // ─── COORDINATE CLICK — click pixel exact di layar ────────
    function coordClick(x, y) {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        for (const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
            el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y}));
        }
        try {
            const t = new Touch({identifier:Date.now(),target:el,clientX:x,clientY:y,radiusX:1,radiusY:1,rotationAngle:0,force:1});
            el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]}));
            el.dispatchEvent(new TouchEvent('touchend',  {bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[t]}));
        } catch(e){}
        return el;
    }

    // ─── TEXT NODE WALKER — scan semua text node di DOM ───────
    // Ini yang fix "AB BANK" plain text — gak dibungkus element proper
    function findByTextNode(keyword) {
        const results = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        let node;
        while ((node = walker.nextNode())) {
            const t = norm(node.textContent);
            if (t === keyword || t.includes(keyword)) {
                const parent = node.parentElement;
                if (parent && isInViewport(parent)) {
                    results.push(parent);
                }
            }
        }
        return results;
    }

    function buildUI() {
        const host = document.createElement('div');
        host.id = 'onyx-host';
        host.style.cssText = `position:fixed!important;top:10px!important;right:10px!important;z-index:2147483647!important;width:310px!important;`;
        document.documentElement.appendChild(host);
        const shadow = host.attachShadow({mode:'open'});

        shadow.innerHTML = `
        <style>
            *{box-sizing:border-box;font-family:monospace;}
            #panel{background:#111;color:#0f0;border:2px solid #0f0;border-radius:8px;font-size:12px;box-shadow:0 0 20px #0f0a;overflow:hidden;}
            #hdr{background:#0a0;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;color:#fff;font-weight:bold;font-size:13px;}
            #body{padding:10px;display:block;}
            #status{color:#ff0;font-weight:bold;margin-bottom:8px;font-size:12px;}
            label{color:#aaa;font-size:11px;display:block;margin-bottom:3px;}
            .inp{width:100%;background:#1a1a1a;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:6px 8px;font-size:12px;margin-bottom:6px;outline:none;}
            .inp.err{border-color:#f55!important;}
            #warn{color:#f55;font-size:11px;margin-bottom:6px;display:none;}
            #bank-sel{width:100%;background:#1a1a1a;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:6px 8px;font-size:12px;margin-bottom:6px;outline:none;}
            #accnum-row{display:flex;gap:4px;margin-bottom:6px;}
            #accnum-inp{flex:1;background:#1a1a1a;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:6px 8px;font-size:12px;outline:none;}
            #accnum-rand{background:#050;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:6px 8px;cursor:pointer;font-size:11px;white-space:nowrap;}
            button{width:100%;padding:7px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;margin-bottom:5px;}
            #run{background:#0a0;color:#fff;}#run:disabled{background:#333;color:#666;cursor:not-allowed;}
            #clr{background:#500;color:#fff;}
            #info{color:#888;margin-bottom:6px;}#info span{color:#0ff;font-weight:bold;}
            hr{border:none;border-top:1px solid #0f03;margin:6px 0;}
            #log{max-height:200px;overflow-y:auto;background:#000;padding:6px;border-radius:4px;border:1px solid #0f03;}
            .acc{color:#0ff;border-bottom:1px solid #0f02;padding:4px 0;line-height:1.6;font-size:11px;}
            .ll{color:#555;font-size:10px;margin-bottom:1px;}
            .sec-title{color:#0f0;font-size:11px;font-weight:bold;margin-bottom:3px;margin-top:6px;border-bottom:1px solid #0f03;padding-bottom:2px;}
        </style>
        <div id="panel">
            <div id="hdr"><span>⚡ QQ88 AutoReg v2.5 — Onyx</span><span id="tog">▼</span></div>
            <div id="body">
                <div id="status">⏳ Standby</div>
                <div class="sec-title">— ĐĂNG KÝ</div>
                <label>📛 Họ và tên <span style="color:#f55">*bắt buộc</span></label>
                <input type="text" class="inp" id="fname" placeholder="VD: Nguyen Van A"/>
                <div id="warn">⚠ Nhập họ và tên trước!</div>
                <div class="sec-title">— BANK</div>
                <label>🏦 Chọn ngân hàng</label>
                <select id="bank-sel"></select>
                <label>💳 Số tài khoản</label>
                <div id="accnum-row">
                    <input type="text" id="accnum-inp" placeholder="Nhập hoặc random"/>
                    <button id="accnum-rand">🎲 Random</button>
                </div>
                <button id="run">▶ RUN FULL AUTO</button>
                <button id="clr">🗑 Xóa danh sách</button>
                <div id="info">Đã lưu: <span id="cnt">0</span> tài khoản</div>
                <hr/>
                <div id="log"></div>
            </div>
        </div>`;

        const $      = s => shadow.querySelector(s);
        const hdr    = $('#hdr'), tog=$('#tog'), body=$('#body');
        const status = $('#status'), fname=$('#fname'), warn=$('#warn');
        const bankSel= $('#bank-sel'), accInp=$('#accnum-inp'), accRnd=$('#accnum-rand');
        const runBtn = $('#run'), clrBtn=$('#clr'), cnt=$('#cnt'), log=$('#log');

        BANKS.forEach(b => { const o=document.createElement('option'); o.value=b; o.textContent=b; bankSel.appendChild(o); });

        hdr.addEventListener('click', () => {
            const h = body.style.display==='none';
            body.style.display=h?'block':'none';
            tog.textContent=h?'▼':'▶';
        });
        fname.addEventListener('input', () => {
            if(fname.value.trim()){fname.classList.remove('err');warn.style.display='none';}
            else fname.classList.add('err');
        });
        accRnd.addEventListener('click', () => { accInp.value=randomAccNum(); });

        function addLog(msg, color='#555') {
            const d=document.createElement('div'); d.className='ll'; d.style.color=color;
            d.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`; log.prepend(d);
        }
        function setStatus(msg, color='#ff0') { status.textContent=msg; status.style.color=color; }
        function updateList() {
            cnt.textContent=getAccs().length;
            log.querySelectorAll('.acc').forEach(e=>e.remove());
            getAccs().slice().reverse().forEach(a=>{
                const d=document.createElement('div'); d.className='acc';
                d.innerHTML=`👤 <b>${a.username}</b> | 📛 ${a.fullname}<br>🔑 ${a.password} | 📱 ${a.phone}<br>🏦 ${a.bank} | 💳 ${a.accnum}<br><span style="color:#444;font-size:10px">${a.ts}</span>`;
                log.appendChild(d);
            });
        }

        async function dismiss(maxRounds=15) {
            for(let i=0;i<maxRounds;i++){
                let hit=false;
                document.querySelectorAll('[class*="close"],[class*="Close"],.modal-close,.popup-close,[aria-label="close"],.icon-close,button.close,.btn-close').forEach(el=>{if(el.offsetParent){el.click();hit=true;}});
                document.querySelectorAll('button,span,div,a,i').forEach(el=>{if(['×','✕','X','❌'].includes(el.textContent.trim())&&el.offsetParent){el.click();hit=true;}});
                if(!hit) break;
                await sleep(600);
            }
        }

        async function dismissTwo() {
            let closed=0;
            for(let attempt=0;attempt<40&&closed<2;attempt++){
                const closers=[
                    ...document.querySelectorAll('[class*="close"],[class*="Close"],.modal-close,.popup-close,[aria-label="close"],.icon-close,button.close,.btn-close'),
                    ...[...document.querySelectorAll('button,span,div,a,i')].filter(el=>['×','✕','X','❌'].includes(el.textContent.trim()))
                ];
                for(const el of closers){
                    if(el.offsetParent){el.click();closed++;addLog(`Tắt popup ${closed}/2`,'#ff0');await sleep(900);if(closed>=2)break;}
                }
                if(closed<2) await sleep(400);
            }
        }

        async function fillRegister(fullname) {
            const username=randomUsername(), phone=randomPhone();
            setStatus('🔍 Quét form đăng ký...','#ff0');
            let inputs=[];
            for(let i=0;i<40;i++){
                inputs=[...document.querySelectorAll('input')].filter(el=>el.type!=='hidden'&&el.type!=='checkbox'&&el.type!=='radio');
                if(inputs.length>=3) break;
                await sleep(300);
            }
            if(inputs.length<3){setStatus('❌ Không thấy form','#f00');addLog('Form không tìm thấy','#f00');return null;}
            let uEl,pEl,nEl,phEl;
            for(const inp of inputs){
                const ph=(inp.placeholder||'').toLowerCase(), nm=(inp.name||inp.id||'').toLowerCase();
                if     (!uEl &&(ph.includes('đăng nhập')||ph.includes('tài khoản')||nm.includes('user')||nm.includes('login'))) uEl=inp;
                else if(!pEl &&(inp.type==='password'||ph.includes('mật khẩu'))) pEl=inp;
                else if(!nEl &&(ph.includes('họ')||ph.includes('tên đầy')||nm.includes('fullname')||nm.includes('name'))) nEl=inp;
                else if(!phEl&&(ph.includes('sđt')||ph.includes('điện thoại')||ph.includes('phone')||inp.type==='tel'||nm.includes('phone'))) phEl=inp;
            }
            if(!uEl&&inputs[0])uEl=inputs[0]; if(!pEl&&inputs[1])pEl=inputs[1];
            if(!nEl&&inputs[2])nEl=inputs[2]; if(!phEl&&inputs[3])phEl=inputs[3];
            if(uEl){setNV(uEl,username);addLog(`User: ${username}`,'#0f0');await sleep(120);}
            if(pEl){setNV(pEl,FIXED_PASSWORD);addLog(`Pass: ${FIXED_PASSWORD}`,'#0f0');await sleep(120);}
            if(nEl){setNV(nEl,fullname);addLog(`Tên: ${fullname}`,'#0f0');await sleep(120);}
            if(phEl){setNV(phEl,phone);addLog(`SĐT: ${phone}`,'#0f0');await sleep(120);}
            await sleep(500);
            setStatus('🖱 Bấm ĐĂNG KÝ...','#ff0');
            let ok=false;
            for(const el of document.querySelectorAll('button,input[type=submit],a')){
                const t=el.textContent.trim().toUpperCase();
                if(t.includes('ĐĂNG KÝ')||t.includes('REGISTER')){el.click();ok=true;addLog('Bấm ĐĂNG KÝ','#0f0');break;}
            }
            if(!ok){setStatus('❌ Không thấy nút ĐK','#f00');return null;}
            return {username, phone};
        }

        async function goWithdraw() {
            setStatus('🔍 Tìm nút Rút Tiền...','#ff0');
            for(let i=0;i<40;i++){
                for(const el of document.querySelectorAll('a,button,div,span,p')){
                    const t=el.textContent.trim().toUpperCase();
                    if(t==='RÚT TIỀN'||t==='RUT TIEN'||t==='RÚTTIỀN'){el.click();addLog('Bấm Rút Tiền','#0ff');return true;}
                }
                await sleep(400);
            }
            addLog('Không tìm thấy nút Rút Tiền','#f55');return false;
        }

        async function clickAddBank() {
            setStatus('🔍 Tìm nút + đỏ...','#ff0');
            for(let attempt=0;attempt<50;attempt++){
                for(const el of document.querySelectorAll('*')){
                    if(!el.offsetParent) continue;
                    const rect=el.getBoundingClientRect();
                    const isRoundish=Math.abs(rect.width-rect.height)<20&&rect.width>30&&rect.width<120;
                    const bg=window.getComputedStyle(el).backgroundColor||'';
                    const red=isRed(bg), txt=el.textContent.trim();
                    if(red&&isRoundish&&txt==='+'){fireClick(el);addLog('Bấm nút + đỏ (exact)','#0ff');return true;}
                    if(red&&isRoundish){fireClick(el);addLog('Bấm nút đỏ tròn','#ff0');return true;}
                }
                if(attempt>15){
                    for(const el of document.querySelectorAll('*')){
                        if(el.textContent.trim()==='+' && el.offsetParent){fireClick(el);addLog('Bấm + fallback','#ff0');return true;}
                    }
                }
                await sleep(400);
            }
            addLog('Không tìm thấy nút + đỏ','#f55');return false;
        }

        // ─── SELECT BANK v2.5 — TreeWalker + coord click ──────
        async function selectBank(bankName) {
            setStatus('🏦 Mở dropdown ngân hàng...','#ff0');

            // STEP 1: buka dropdown
            let opened=false;
            for(let attempt=0;attempt<40&&!opened;attempt++){
                for(const el of document.querySelectorAll('*')){
                    if(!el.offsetParent) continue;
                    const rect=el.getBoundingClientRect();
                    const bg=window.getComputedStyle(el).backgroundColor||'';
                    if(isBlue(bg)&&rect.width>20&&rect.width<120&&rect.height>20&&rect.height<120){
                        fireClick(el); addLog('Click tombol biru dropdown','#0ff'); opened=true; break;
                    }
                }
                if(!opened){
                    for(const el of document.querySelectorAll('*')){
                        if(!el.offsetParent) continue;
                        if(el.textContent.trim().includes('Chọn ngân hàng')||el.textContent.trim().includes('Chon ngan hang')){
                            fireClick(el.parentElement||el); addLog('Click row Chọn ngân hàng','#ff0'); opened=true; break;
                        }
                    }
                }
                if(!opened) await sleep(400);
            }
            await sleep(1500);

            // STEP 2: isi search box
            setStatus('🔍 Isi search box...','#ff0');
            let searchEl=null;
            for(let i=0;i<30;i++){
                for(const inp of document.querySelectorAll('input')){
                    const r=inp.getBoundingClientRect();
                    if(r.width===0||r.height===0) continue;
                    const ph=(inp.placeholder||'').toLowerCase();
                    if(ph.includes('tìm')||ph.includes('tim')||ph.includes('search')||ph.includes('kiếm')||(inp.name||inp.id||'').toLowerCase().includes('search')){
                        searchEl=inp; break;
                    }
                }
                if(searchEl) break;
                await sleep(300);
            }

            if(searchEl){
                searchEl.focus();
                setNV(searchEl,''); await sleep(100);
                setNV(searchEl, bankName);
                addLog(`Search: ${bankName}`,'#0f0');
                await sleep(1800); // tunggu list render
            } else {
                addLog('Search box tidak ditemukan','#f55');
                await sleep(800);
            }

            // STEP 3: CLICK ITEM — v2.5 core: TreeWalker text node scan
            setStatus('🖱 Klik item bank...','#ff0');
            const target    = norm(bankName);
            const firstWord = target.split(' ')[0];

            for(let round=0; round<20; round++){
                // A — TreeWalker: scan text nodes langsung (fix utama v2.5)
                const byText = findByTextNode(target);
                for(const el of byText){
                    // prefer elemen paling kecil (bukan container besar)
                    const r=el.getBoundingClientRect();
                    if(r.width > 0 && r.height > 0 && r.height < 120){
                        fireClick(el);
                        addLog(`✅ TextNode click [${round}]: ${el.textContent.trim()}`,'#0f0');
                        return true;
                    }
                }

                // B — element scan biasa (backup)
                for(const el of document.querySelectorAll('li,div,span,p,a,button,td,label')){
                    if(!isInViewport(el)) continue;
                    const t=norm(el.textContent);
                    if(t===target && el.getBoundingClientRect().height < 120){
                        fireClick(el);
                        addLog(`✅ Element exact [${round}]: ${el.textContent.trim()}`,'#0f0');
                        return true;
                    }
                }

                // C — partial firstWord
                for(const el of document.querySelectorAll('li,div,span,p,a,button,td,label')){
                    if(!isInViewport(el)) continue;
                    const t=norm(el.textContent);
                    const r=el.getBoundingClientRect();
                    if(t.startsWith(firstWord) && t.length<target.length+20 && r.height<120){
                        fireClick(el);
                        addLog(`✅ Partial click [${round}]: ${el.textContent.trim()}`,'#ff0');
                        return true;
                    }
                }

                await sleep(300);
            }

            // D — COORDINATE FALLBACK: click tepat di posisi item (bawah search box)
            // Dari screenshot: item ada ~130px di bawah top viewport, atau ~60px di bawah search
            if(searchEl){
                const sr = searchEl.getBoundingClientRect();
                // item pertama biasanya ~60-80px di bawah search box
                for(const offsetY of [70, 90, 110, 50, 130]){
                    const cx = sr.left + sr.width/2;
                    const cy = sr.bottom + offsetY;
                    const hit = coordClick(cx, cy);
                    if(hit){
                        addLog(`✅ Coord click offset +${offsetY}px: ${hit.textContent.trim()}`,'#ff0');
                        // verify: cek apakah bank sudah dipilih (dropdown menutup)
                        await sleep(600);
                        const stillOpen = document.body.textContent.includes('Chọn ngân hàng của bạn');
                        if(!stillOpen){
                            addLog('Dropdown menutup — bank terpilih ✅','#0f0');
                            return true;
                        }
                    }
                }
            }

            // E — scan seluruh viewport dengan grid koordinat
            setStatus('🔍 Grid scan viewport...','#ff0');
            const W=window.innerWidth, H=window.innerHeight;
            for(let y=200; y<H-50; y+=20){
                for(let x=20; x<W-20; x+=W-40){
                    const el=document.elementFromPoint(x,y);
                    if(el && norm(el.textContent).includes(firstWord)){
                        coordClick(x,y);
                        addLog(`✅ Grid scan klik (${x},${y}): ${el.textContent.trim()}`,'#ff0');
                        return true;
                    }
                }
            }

            addLog(`❌ Semua metode gagal: ${bankName}`,'#f55');
            return false;
        }

        async function fillBankForm(accnum) {
            setStatus('💳 Điền thông tin bank...','#ff0');
            await sleep(700);
            function vis(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
            const inputs=[...document.querySelectorAll('input')].filter(el=>el.type!=='hidden'&&vis(el));
            let accEl,branchEl,pw1El,pw2El;
            for(const inp of inputs){
                const ph=(inp.placeholder||'').toLowerCase(), nm=(inp.name||inp.id||'').toLowerCase();
                if     (!accEl   &&(ph.includes('số tài khoản')||ph.includes('so tai khoan')||nm.includes('account')||nm.includes('card'))) accEl=inp;
                else if(!branchEl&&(ph.includes('chi nhánh')||ph.includes('chi nhanh')||nm.includes('branch'))) branchEl=inp;
                else if(!pw1El   &&inp.type==='password') pw1El=inp;
                else if(!pw2El   &&inp.type==='password'&&inp!==pw1El) pw2El=inp;
            }
            const pw=[...inputs].filter(e=>e.type==='password');
            if(!pw1El&&pw[0])pw1El=pw[0]; if(!pw2El&&pw[1])pw2El=pw[1];
            if(accEl)   {setNV(accEl,   accnum);           addLog(`STK: ${accnum}`,'#0f0');         await sleep(150);}
            if(branchEl){setNV(branchEl,BRANCH);            addLog(`CN: ${BRANCH}`,'#0f0');          await sleep(150);}
            if(pw1El)   {setNV(pw1El,   WITHDRAW_PASSWORD);addLog('MK rút: set','#0f0');             await sleep(150);}
            if(pw2El)   {setNV(pw2El,   WITHDRAW_PASSWORD);addLog('Xác nhận MK rút: set','#0f0');   await sleep(150);}
            await sleep(600);
        }

        async function clickConfirm() {
            setStatus('✅ Bấm Xác nhận...','#ff0');
            for(let i=0;i<25;i++){
                for(const el of document.querySelectorAll('button,a,div,span')){
                    const t=el.textContent.trim().toUpperCase();
                    if((t.includes('XÁC NHẬN')||t.includes('XAC NHAN')||t.includes('CONFIRM'))&&el.offsetParent){
                        fireClick(el);addLog('Bấm Xác nhận','#0f0');return true;
                    }
                }
                await sleep(400);
            }
            addLog('Tidak ada tombol Xác nhận','#f55');return false;
        }

        async function runAll() {
            const fullname=fname.value.trim(), bankName=bankSel.value;
            const accnum=accInp.value.trim()||randomAccNum();
            if(!fullname){fname.classList.add('err');warn.style.display='block';setStatus('⚠ Nhập họ tên!','#f55');return;}
            warn.style.display='none';
            runBtn.disabled=true; runBtn.textContent='⏳ Đang chạy...';
            addLog('=== BẮT ĐẦU FULL FLOW ===','#0f0');

            if(!location.href.includes('register')){
                sessionStorage.setItem('onyx_fn',fullname);
                sessionStorage.setItem('onyx_bank',bankName);
                sessionStorage.setItem('onyx_accnum',accnum);
                location.href='https://www.2006666.com/m/register';
                return;
            }

            await sleep(1200); await dismiss(10); await sleep(600);
            const regInfo=await fillRegister(fullname);
            if(!regInfo){runBtn.disabled=false;runBtn.textContent='▶ RUN FULL AUTO';return;}
            setStatus('⏳ Chờ đăng ký xong...','#ff0');
            await sleep(3000); await dismissTwo(); await sleep(1200);
            const wd=await goWithdraw();
            if(!wd){runBtn.disabled=false;runBtn.textContent='▶ RUN FULL AUTO';return;}
            await sleep(2000);
            await clickAddBank(); await sleep(2000);
            await selectBank(bankName); await sleep(1200);
            await fillBankForm(accnum);
            await clickConfirm(); await sleep(1500);

            const acc={
                username:regInfo.username, password:FIXED_PASSWORD,
                fullname, phone:regInfo.phone,
                bank:bankName, accnum,
                withdrawPw:WITHDRAW_PASSWORD,
                ts:new Date().toLocaleString('vi-VN')
            };
            saveAcc(acc); updateList();
            setStatus(`✅ Hoàn tất: ${regInfo.username}`,'#0f0');
            addLog(`✅ Xong! User:${regInfo.username} | Bank:${bankName} | STK:${accnum}`,'#0ff');
            runBtn.disabled=false; runBtn.textContent='▶ RUN FULL AUTO';
        }

        runBtn.addEventListener('click', runAll);
        clrBtn.addEventListener('click', ()=>{GM_setValue('q88_accs',[]);updateList();addLog('Đã xóa danh sách','#f55');});

        const savedFn=sessionStorage.getItem('onyx_fn');
        const savedBank=sessionStorage.getItem('onyx_bank');
        const savedAccNum=sessionStorage.getItem('onyx_accnum');

        if(savedFn&&location.href.includes('register')){
            sessionStorage.removeItem('onyx_fn');
            sessionStorage.removeItem('onyx_bank');
            sessionStorage.removeItem('onyx_accnum');
            fname.value=savedFn;
            if(savedBank) bankSel.value=savedBank;
            if(savedAccNum) accInp.value=savedAccNum;
            setTimeout(async()=>{
                await dismiss(10); await sleep(600);
                const regInfo=await fillRegister(savedFn);
                if(!regInfo) return;
                await sleep(3000); await dismissTwo(); await sleep(1200);
                await goWithdraw(); await sleep(2000);
                await clickAddBank(); await sleep(2000);
                await selectBank(savedBank||BANKS[0]); await sleep(1200);
                await fillBankForm(savedAccNum||randomAccNum());
                await clickConfirm(); await sleep(1500);
                const acc={
                    username:regInfo.username,password:FIXED_PASSWORD,
                    fullname:savedFn,phone:regInfo.phone,
                    bank:savedBank,accnum:savedAccNum,
                    withdrawPw:WITHDRAW_PASSWORD,
                    ts:new Date().toLocaleString('vi-VN')
                };
                saveAcc(acc); updateList();
                setStatus(`✅ Hoàn tất: ${regInfo.username}`,'#0f0');
                runBtn.disabled=false; runBtn.textContent='▶ RUN FULL AUTO';
            },2000);
        }

        updateList();
        addLog('Onyx v2.5 loaded — 6767','#444');
    }

    if(document.body) buildUI();
    else {
        document.addEventListener('DOMContentLoaded', buildUI);
        window.addEventListener('load',()=>{if(!document.getElementById('onyx-host'))buildUI();});
    }
})(); 
