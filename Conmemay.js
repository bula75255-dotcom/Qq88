// ==UserScript==
// @name         reg qq88 cre:labubu36
// @namespace    http://tampermonkey.net/
// @version      2.8
// @description  Auto register + auto add bank QQ88
// @author       Onyx
// @match        *://wwwtiktokcomvn.com/*
// @match        *://www.wwwtiktokcomvn.com/*
// @match        *://*/*
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
        'MAFC','MB BANK','MBV','MSB BANK','NAMA BANK','NCB','NHB','OCB BANK',
        'PGBANK','PUBLICBANK','PVCOMBANK','SACOMBANK','SAIGONBANK','SCB','SCBVL',
        'SEABANK','SHB BANK','SHINHAN BANK VN','TECHCOMBANK','TIMO BANK','TPBANK',
        'UBANK','UOB','VDB','VIB BANK','VIETA BANK','VIETBANK','VIETCOMBANK',
        'VIETIN BANK','VIKKI BANK','VPBANK','VIETNAM BANK FOR SOCIAL POLICIES'
    ];

    function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
    function randomPhone(){
        const p=['09','08','07','03'][randInt(0,3)];
        let n=p; for(let i=0;i<8;i++) n+=randInt(0,9); return n;
    }
    function randomUsername(){
        const c='abcdefghijklmnopqrstuvwxyz0123456789';
        let u='u'; for(let i=0;i<10;i++) u+=c[randInt(0,c.length-1)]; return u;
    }
    function randomAccNum(){
        let n=''; for(let i=0;i<10;i++) n+=randInt(0,9); return n;
    }
    function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
    function norm(s){return s.replace(/\s+/g,' ').trim().toUpperCase();}

    function setNV(el,val){
        try{
            const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(el,val);
        }catch(e){el.value=val;}
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        el.dispatchEvent(new Event('blur',{bubbles:true}));
    }

    function isRed(color){
        const m=color.match(/\d+/g);
        if(!m||m.length<3) return false;
        return +m[0]>150&&+m[1]<100&&+m[2]<100;
    }
    function isBlue(color){
        const m=color.match(/\d+/g);
        if(!m||m.length<3) return false;
        return +m[2]>150&&+m[0]<150&&+m[1]<150;
    }
    function isBlueTxt(color){
        // text color biru: r<100, g<150, b>150
        const m=color.match(/\d+/g);
        if(!m||m.length<3) return false;
        return +m[2]>150&&+m[0]<120;
    }
    function rectVisible(r){
        return r.width>0&&r.height>0&&r.top<window.innerHeight&&r.bottom>0&&r.left<window.innerWidth&&r.right>0;
    }
    function isInViewport(el){
        const r=el.getBoundingClientRect();
        return rectVisible(r);
    }

    function saveAcc(acc){let list=GM_getValue('q88_accs',[]);list.push(acc);GM_setValue('q88_accs',list);}
    function getAccs(){return GM_getValue('q88_accs',[]);}

    function fireAll(el,cx,cy){
        try{
            const t=new Touch({identifier:Date.now(),target:el,clientX:cx,clientY:cy,radiusX:10,radiusY:10,rotationAngle:0,force:0.5});
            el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t],view:window}));
            el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[t],view:window}));
        }catch(e){}
        for(const type of ['pointerdown','mousedown','pointerup','mouseup','click']){
            el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy}));
        }
    }
    function fireClick(el){
        const r=el.getBoundingClientRect();
        fireAll(el,r.left+r.width/2,r.top+r.height/2);
    }
    function coordClick(x,y){
        const el=document.elementFromPoint(x,y);
        if(!el) return null;
        fireAll(el,x,y);
        return el;
    }
    function findByTextNode(keyword){
        const results=[];
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);
        let node;
        while((node=walker.nextNode())){
            const t=norm(node.textContent);
            if(t.includes(keyword)){
                const p=node.parentElement;
                if(p&&isInViewport(p)) results.push(p);
            }
        }
        return results;
    }

    let panelHost=null;
    function hidePanel(){if(panelHost) panelHost.style.visibility='hidden';}
    function showPanel(){if(panelHost) panelHost.style.visibility='visible';}

    // ─── CLICK XÁC NHẬN TRONG MODAL THÔNG BÁO ───────────────
    // Từ screenshot: modal có "Hủy bỏ" trái + "Xác nhận" BIRU kanan
    // Cần click "Xác nhận" biru, BUKAN nút đỏ di belakang
    async function clickModalConfirm(addLog, setStatus){
        setStatus('🔍 Tìm Xác nhận trong modal...','#ff0');
        hidePanel();
        await sleep(300);

        for(let round=0; round<30; round++){
            // PASS A — cari "Xác nhận" dengan warna teks BIRU di dalam modal
            // Modal biasanya ada "Thông Báo" + "Hủy bỏ" + "Xác nhận"
            const allEls=[...document.querySelectorAll('*')];

            // Cari container modal dulu
            let modalEl=null;
            for(const el of allEls){
                const t=el.textContent;
                if(t.includes('Thông Báo')&&t.includes('Hủy bỏ')&&t.includes('Xác nhận')){
                    const r=el.getBoundingClientRect();
                    if(r.width>100&&r.height>100&&r.width<window.innerWidth*0.95){
                        modalEl=el;
                        break;
                    }
                }
            }

            if(modalEl){
                addLog(`Modal found: ${modalEl.tagName}`,'#0ff');
                // Scan di dalam modal untuk "Xác nhận"
                const inside=[...modalEl.querySelectorAll('*')];
                // Sort: prefer elemen kanan (right half) dan biru
                const xcNhan=inside.filter(el=>{
                    const t=norm(el.textContent);
                    const r=el.getBoundingClientRect();
                    return (t==='XÁC NHẬN'||t.includes('XÁC NHẬN'))&&rectVisible(r)&&r.height<80;
                });

                // Sort by: blue text color first, then rightmost
                xcNhan.sort((a,b)=>{
                    const ca=window.getComputedStyle(a).color;
                    const cb=window.getComputedStyle(b).color;
                    const blueA=isBlueTxt(ca)?10:0;
                    const blueB=isBlueTxt(cb)?10:0;
                    const ra=a.getBoundingClientRect();
                    const rb=b.getBoundingClientRect();
                    return (blueB+rb.left/100)-(blueA+ra.left/100);
                });

                if(xcNhan.length>0){
                    const target=xcNhan[0];
                    const r=target.getBoundingClientRect();
                    const cs=window.getComputedStyle(target);
                    addLog(`M-A: "${target.textContent.trim()}" color:${cs.color} @(${Math.round(r.left)},${Math.round(r.top)})`,'#0f0');
                    fireAll(target, r.left+r.width/2, r.top+r.height/2);
                    await sleep(600);
                    // Cek modal hilang
                    if(!document.body.textContent.includes('Thông Báo')||!document.body.textContent.includes('Hủy bỏ')){
                        addLog('✅ Modal Xác nhận sukses!','#0f0');
                        showPanel();
                        return true;
                    }
                    // Coba semua candidate
                    for(const el of xcNhan){
                        fireClick(el);
                        await sleep(400);
                    }
                }

                // PASS B — koordinat: "Xác nhận" biru selalu di kanan bawah modal
                const mr=modalEl.getBoundingClientRect();
                // Kanan bawah modal = area "Xác nhận"
                const cx=mr.left+mr.width*0.75;
                const cy=mr.bottom-40; // 40px dari bawah modal
                const hit=coordClick(cx,cy);
                if(hit) addLog(`M-B coord modal: (${Math.round(cx)},${Math.round(cy)}) → ${hit.textContent.trim().substring(0,20)}`,'#ff0');
                await sleep(500);
                if(!document.body.textContent.includes('Hủy bỏ')){
                    addLog('✅ Modal closed!','#0f0');
                    showPanel();
                    return true;
                }

                // PASS C — scan row bawah modal (baris button)
                // Dari screenshot: button row ada di ~y=850 (bottom modal)
                for(let x=mr.left+mr.width*0.5; x<mr.right-10; x+=15){
                    const el=document.elementFromPoint(x, mr.bottom-50);
                    if(!el) continue;
                    const t=norm(el.textContent);
                    const color=window.getComputedStyle(el).color;
                    if(t.includes('XÁC NHẬN')||isBlueTxt(color)){
                        fireAll(el,x,mr.bottom-50);
                        addLog(`M-C scan row: ${el.textContent.trim()}`,'#ff0');
                        await sleep(400);
                        break;
                    }
                }

            } else {
                // Modal belum muncul — cari langsung
                // PASS D — TreeWalker + blue text filter
                const byText=findByTextNode('XÁC NHẬN');
                for(const el of byText){
                    const r=el.getBoundingClientRect();
                    const color=window.getComputedStyle(el).color;
                    const bg=window.getComputedStyle(el).backgroundColor;
                    // Prioritas: biru text, bukan background merah
                    if(isBlueTxt(color)||(!isRed(bg)&&r.height<60)){
                        addLog(`M-D textnode blue: "${el.textContent.trim()}" c:${color}`,'#0ff');
                        fireAll(el,r.left+r.width/2,r.top+r.height/2);
                        await sleep(400);
                    }
                }

                // PASS E — scan semua "Xác nhận" ambil yang paling kanan
                const allXN=[...document.querySelectorAll('*')].filter(el=>{
                    const t=norm(el.textContent);
                    const r=el.getBoundingClientRect();
                    return (t==='XÁC NHẬN'||t==='XAC NHAN')&&rectVisible(r)&&r.height<80;
                });
                // Sort rightmost = biru di modal
                allXN.sort((a,b)=>b.getBoundingClientRect().left-a.getBoundingClientRect().left);
                for(const el of allXN.slice(0,2)){
                    const r=el.getBoundingClientRect();
                    const color=window.getComputedStyle(el).color;
                    addLog(`M-E rightmost: "${el.textContent.trim()}" @left:${Math.round(r.left)} c:${color}`,'#ff0');
                    fireAll(el,r.left+r.width/2,r.top+r.height/2);
                    await sleep(400);
                }
            }

            await sleep(400);

            // Check sukses
            if(!document.body.textContent.includes('Hủy bỏ')){
                addLog('✅ Modal đã đóng!','#0f0');
                showPanel();
                return true;
            }
        }

        showPanel();
        addLog('❌ Không thể click Xác nhận modal','#f55');
        return false;
    }

    // ─── CLICK NÚT ĐỎ XÁC NHẬN (form bank, trước modal) ─────
    async function clickRedConfirm(addLog, setStatus){
        setStatus('✅ Bấm nút đỏ Xác nhận...','#ff0');
        hidePanel();
        await sleep(300);

        for(let round=0; round<20; round++){
            // Cari nút merah besar dengan text Xác nhận
            for(const el of document.querySelectorAll('button,a,div,span')){
                const t=norm(el.textContent);
                const r=el.getBoundingClientRect();
                const bg=window.getComputedStyle(el).backgroundColor||'';
                if((t==='XÁC NHẬN'||t==='XAC NHAN')&&isRed(bg)&&rectVisible(r)&&r.width>100){
                    addLog(`Red confirm: ${el.tagName} (${Math.round(r.width)}x${Math.round(r.height)})`,'#0f0');
                    fireAll(el,r.left+r.width/2,r.top+r.height/2);
                    showPanel();
                    return true;
                }
            }
            // Coord: nút merah selalu full-width di bawah form
            const W=window.innerWidth, H=window.innerHeight;
            for(let y=H-180;y<H-10;y+=15){
                const el=document.elementFromPoint(W/2,y);
                if(!el) continue;
                const bg=window.getComputedStyle(el).backgroundColor||'';
                const t=norm(el.textContent);
                if(isRed(bg)&&(t.includes('XÁC NHẬN')||t.includes('CONFIRM'))){
                    fireAll(el,W/2,y);
                    addLog(`Red coord (${Math.round(W/2)},${y}): ${el.textContent.trim().substring(0,20)}`,'#ff0');
                    showPanel();
                    return true;
                }
            }
            // Parent chain
            const byText=findByTextNode('XÁC NHẬN');
            for(const el of byText){
                let node=el;
                for(let i=0;i<4;i++){
                    if(!node||!node.parentElement) break;
                    node=node.parentElement;
                    const bg=window.getComputedStyle(node).backgroundColor||'';
                    const r=node.getBoundingClientRect();
                    if(isRed(bg)&&rectVisible(r)){
                        fireAll(node,r.left+r.width/2,r.top+r.height/2);
                        addLog(`Red parent[${i}]: ${node.tagName}`,'#ff0');
                        showPanel();
                        return true;
                    }
                }
            }
            await sleep(300);
        }
        showPanel();
        addLog('❌ Không tìm thấy nút đỏ','#f55');
        return false;
    }

    function buildUI(){
        const host=document.createElement('div');
        host.id='onyx-host';
        host.style.cssText='position:fixed!important;top:10px!important;right:10px!important;z-index:2147483647!important;width:310px!important;';
        document.documentElement.appendChild(host);
        panelHost=host;
        const shadow=host.attachShadow({mode:'open'});

        shadow.innerHTML=`
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
            #log{max-height:180px;overflow-y:auto;background:#000;padding:6px;border-radius:4px;border:1px solid #0f03;}
            .acc{color:#0ff;border-bottom:1px solid #0f02;padding:4px 0;line-height:1.6;font-size:11px;}
            .ll{color:#555;font-size:10px;margin-bottom:1px;}
            .sec-title{color:#0f0;font-size:11px;font-weight:bold;margin-bottom:3px;margin-top:6px;border-bottom:1px solid #0f03;padding-bottom:2px;}
        </style>
        <div id="panel">
            <div id="hdr"><span>⚡ reg qq88 cre:labubu36</span><span id="tog">▼</span></div>
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

        const $=s=>shadow.querySelector(s);
        const hdr=$('#hdr'),tog=$('#tog'),body=$('#body');
        const status=$('#status'),fname=$('#fname'),warn=$('#warn');
        const bankSel=$('#bank-sel'),accInp=$('#accnum-inp'),accRnd=$('#accnum-rand');
        const runBtn=$('#run'),clrBtn=$('#clr'),cnt=$('#cnt'),log=$('#log');

        BANKS.forEach(b=>{const o=document.createElement('option');o.value=b;o.textContent=b;bankSel.appendChild(o);});
        hdr.addEventListener('click',()=>{const h=body.style.display==='none';body.style.display=h?'block':'none';tog.textContent=h?'▼':'▶';});
        fname.addEventListener('input',()=>{if(fname.value.trim()){fname.classList.remove('err');warn.style.display='none';}else fname.classList.add('err');});
        accRnd.addEventListener('click',()=>{accInp.value=randomAccNum();});

        function addLog(msg,color='#555'){
            const d=document.createElement('div');d.className='ll';d.style.color=color;
            d.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;log.prepend(d);
        }
        function setStatus(msg,color='#ff0'){status.textContent=msg;status.style.color=color;}
        function updateList(){
            cnt.textContent=getAccs().length;
            log.querySelectorAll('.acc').forEach(e=>e.remove());
            getAccs().slice().reverse().forEach(a=>{
                const d=document.createElement('div');d.className='acc';
                d.innerHTML=`👤 <b>${a.username}</b> | 📛 ${a.fullname}<br>🔑 ${a.password} | 📱 ${a.phone}<br>🏦 ${a.bank} | 💳 ${a.accnum}<br><span style="color:#444;font-size:10px">${a.ts}</span>`;
                log.appendChild(d);
            });
        }

        async function dismiss(maxRounds=15){
            for(let i=0;i<maxRounds;i++){
                let hit=false;
                document.querySelectorAll('[class*="close"],[class*="Close"],.modal-close,.popup-close,[aria-label="close"],.icon-close,button.close,.btn-close').forEach(el=>{if(el.offsetParent){el.click();hit=true;}});
                document.querySelectorAll('button,span,div,a,i').forEach(el=>{if(['×','✕','X','❌'].includes(el.textContent.trim())&&el.offsetParent){el.click();hit=true;}});
                if(!hit) break;
                await sleep(600);
            }
        }
        async function dismissTwo(){
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

        async function fillRegister(fullname){
            const username=randomUsername(),phone=randomPhone();
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
                const ph=(inp.placeholder||'').toLowerCase(),nm=(inp.name||inp.id||'').toLowerCase();
                if     (!uEl &&(ph.includes('đăng nhập')||ph.includes('tài khoản')||nm.includes('user')||nm.includes('login'))) uEl=inp;
                else if(!pEl &&(inp.type==='password'||ph.includes('mật khẩu'))) pEl=inp;
                else if(!nEl &&(ph.includes('họ')||ph.includes('tên đầy')||nm.includes('fullname')||nm.includes('name'))) nEl=inp;
                else if(!phEl&&(ph.includes('sđt')||ph.includes('điện thoại')||ph.includes('phone')||inp.type==='tel'||nm.includes('phone'))) phEl=inp;
            }
            if(!uEl&&inputs[0])uEl=inputs[0];if(!pEl&&inputs[1])pEl=inputs[1];
            if(!nEl&&inputs[2])nEl=inputs[2];if(!phEl&&inputs[3])phEl=inputs[3];
            if(uEl){setNV(uEl,username);addLog(`User: ${username}`,'#0f0');await sleep(120);}
            if(pEl){setNV(pEl,FIXED_PASSWORD);addLog(`Pass: ${FIXED_PASSWORD}`,'#0f0');await sleep(120);}
            if(nEl){setNV(nEl,fullname);addLog(`Tên: ${fullname}`,'#0f0');await sleep(120);}
            if(phEl){setNV(phEl,phone);addLog(`SĐT: ${phone}`,'#0f0');await sleep(120);}
            await sleep(500);
            let ok=false;
            for(const el of document.querySelectorAll('button,input[type=submit],a')){
                const t=el.textContent.trim().toUpperCase();
                if(t.includes('ĐĂNG KÝ')||t.includes('REGISTER')){el.click();ok=true;addLog('Bấm ĐĂNG KÝ','#0f0');break;}
            }
            if(!ok){setStatus('❌ Không thấy nút ĐK','#f00');return null;}
            return{username,phone};
        }

        async function goWithdraw(){
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

        async function clickAddBank(){
            setStatus('🔍 Tìm nút + đỏ...','#ff0');
            for(let attempt=0;attempt<50;attempt++){
                for(const el of document.querySelectorAll('*')){
                    if(!el.offsetParent) continue;
                    const rect=el.getBoundingClientRect();
                    const isRoundish=Math.abs(rect.width-rect.height)<20&&rect.width>30&&rect.width<120;
                    const bg=window.getComputedStyle(el).backgroundColor||'';
                    const red=isRed(bg),txt=el.textContent.trim();
                    if(red&&isRoundish&&txt==='+'){fireClick(el);addLog('Bấm nút + đỏ','#0ff');return true;}
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

        async function selectBank(bankName){
            setStatus('🏦 Mở dropdown...','#ff0');
            let opened=false;
            for(let attempt=0;attempt<40&&!opened;attempt++){
                for(const el of document.querySelectorAll('*')){
                    if(!el.offsetParent) continue;
                    const rect=el.getBoundingClientRect();
                    const bg=window.getComputedStyle(el).backgroundColor||'';
                    if(isBlue(bg)&&rect.width>20&&rect.width<120&&rect.height>20&&rect.height<120){
                        fireClick(el);addLog('Click tombol biru','#0ff');opened=true;break;
                    }
                }
                if(!opened){
                    for(const el of document.querySelectorAll('*')){
                        if(!el.offsetParent) continue;
                        if(el.textContent.trim().includes('Chọn ngân hàng')){
                            fireClick(el.parentElement||el);addLog('Click row Chọn ngân hàng','#ff0');opened=true;break;
                        }
                    }
                }
                if(!opened) await sleep(400);
            }
            await sleep(1500);
            let searchEl=null;
            for(let i=0;i<30;i++){
                for(const inp of document.querySelectorAll('input')){
                    const r=inp.getBoundingClientRect();
                    if(r.width===0||r.height===0) continue;
                    const ph=(inp.placeholder||'').toLowerCase();
                    if(ph.includes('tìm')||ph.includes('tim')||ph.includes('search')||ph.includes('kiếm')){
                        searchEl=inp;break;
                    }
                }
                if(searchEl) break;
                await sleep(300);
            }
            if(searchEl){
                searchEl.focus();setNV(searchEl,'');await sleep(100);
                setNV(searchEl,bankName);addLog(`Search: ${bankName}`,'#0f0');
                await sleep(1800);
            }
            const target=norm(bankName),firstWord=target.split(' ')[0];
            for(let round=0;round<20;round++){
                const byText=findByTextNode(target);
                for(const el of byText){
                    const r=el.getBoundingClientRect();
                    if(r.width>0&&r.height>0&&r.height<120){fireClick(el);addLog(`✅ Bank: ${el.textContent.trim()}`,'#0f0');return true;}
                }
                for(const el of document.querySelectorAll('li,div,span,p,a,button,td,label')){
                    if(!isInViewport(el)) continue;
                    const t=norm(el.textContent),r=el.getBoundingClientRect();
                    if((t===target||(t.startsWith(firstWord)&&t.length<target.length+20))&&r.height<120){
                        fireClick(el);addLog(`✅ Bank elem: ${el.textContent.trim()}`,'#0f0');return true;
                    }
                }
                await sleep(300);
            }
            if(searchEl){
                const sr=searchEl.getBoundingClientRect();
                for(const oy of [70,90,60,110,50,130]){
                    const hit=coordClick(sr.left+sr.width/2,sr.bottom+oy);
                    if(hit){addLog(`✅ Coord bank +${oy}px`,'#ff0');return true;}
                }
            }
            addLog(`❌ Gagal pilih bank: ${bankName}`,'#f55');return false;
        }

        async function fillBankForm(accnum){
            setStatus('💳 Điền thông tin bank...','#ff0');
            await sleep(700);
            function vis(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
            const inputs=[...document.querySelectorAll('input')].filter(el=>el.type!=='hidden'&&vis(el));
            let accEl,branchEl,pw1El,pw2El;
            for(const inp of inputs){
                const ph=(inp.placeholder||'').toLowerCase(),nm=(inp.name||inp.id||'').toLowerCase();
                if     (!accEl   &&(ph.includes('số tài khoản')||ph.includes('so tai khoan')||nm.includes('account')||nm.includes('card'))) accEl=inp;
                else if(!branchEl&&(ph.includes('chi nhánh')||ph.includes('chi nhanh')||nm.includes('branch'))) branchEl=inp;
                else if(!pw1El   &&inp.type==='password') pw1El=inp;
                else if(!pw2El   &&inp.type==='password'&&inp!==pw1El) pw2El=inp;
            }
            const pw=[...inputs].filter(e=>e.type==='password');
            if(!pw1El&&pw[0])pw1El=pw[0];if(!pw2El&&pw[1])pw2El=pw[1];
            if(accEl)   {setNV(accEl,   accnum);           addLog(`STK: ${accnum}`,'#0f0');       await sleep(150);}
            if(branchEl){setNV(branchEl,BRANCH);            addLog(`CN: ${BRANCH}`,'#0f0');        await sleep(150);}
            if(pw1El)   {setNV(pw1El,   WITHDRAW_PASSWORD);addLog('MK rút: set','#0f0');           await sleep(150);}
            if(pw2El)   {setNV(pw2El,   WITHDRAW_PASSWORD);addLog('Xác nhận MK rút: set','#0f0'); await sleep(150);}
            await sleep(600);
        }

        // ─── MAIN FLOW ────────────────────────────────────────
        async function runAll(){
            const fullname=fname.value.trim(),bankName=bankSel.value;
            const accnum=accInp.value.trim()||randomAccNum();
            if(!fullname){fname.classList.add('err');warn.style.display='block';setStatus('⚠ Nhập họ tên!','#f55');return;}
            warn.style.display='none';
            runBtn.disabled=true;runBtn.textContent='⏳ Đang chạy...';
            addLog('=== BẮT ĐẦU FULL FLOW ===','#0f0');

            if(!location.href.includes('register')){
                sessionStorage.setItem('onyx_fn',fullname);
                sessionStorage.setItem('onyx_bank',bankName);
                sessionStorage.setItem('onyx_accnum',accnum);
                location.href='https://www.2006666.com/m/register';
                return;
            }

            await sleep(1200);await dismiss(10);await sleep(600);
            const regInfo=await fillRegister(fullname);
            if(!regInfo){runBtn.disabled=false;runBtn.textContent='▶ RUN FULL AUTO';return;}
            setStatus('⏳ Chờ đăng ký xong...','#ff0');
            await sleep(3000);await dismissTwo();await sleep(1200);
            const wd=await goWithdraw();
            if(!wd){runBtn.disabled=false;runBtn.textContent='▶ RUN FULL AUTO';return;}
            await sleep(2000);
            await clickAddBank();await sleep(2000);
            await selectBank(bankName);await sleep(1200);
            await fillBankForm(accnum);

            // Step 1: click nút đỏ Xác nhận → memunculkan modal Thông Báo
            await clickRedConfirm(addLog,setStatus);
            await sleep(2000);

            // Step 2: click Xác nhận BIRU dalam modal Thông Báo
            await clickModalConfirm(addLog,setStatus);
            await sleep(1500);

            const acc={
                username:regInfo.username,password:FIXED_PASSWORD,
                fullname,phone:regInfo.phone,
                bank:bankName,accnum,
                withdrawPw:WITHDRAW_PASSWORD,
                ts:new Date().toLocaleString('vi-VN')
            };
            saveAcc(acc);updateList();
            setStatus(`✅ Hoàn tất: ${regInfo.username}`,'#0f0');
            addLog(`✅ Xong! User:${regInfo.username} | Bank:${bankName} | STK:${accnum}`,'#0ff');
            runBtn.disabled=false;runBtn.textContent='▶ RUN FULL AUTO';
        }

        runBtn.addEventListener('click',runAll);
        clrBtn.addEventListener('click',()=>{GM_setValue('q88_accs',[]);updateList();addLog('Đã xóa danh sách','#f55');});

        const savedFn=sessionStorage.getItem('onyx_fn');
        const savedBank=sessionStorage.getItem('onyx_bank');
        const savedAccNum=sessionStorage.getItem('onyx_accnum');

        if(savedFn&&location.href.includes('register')){
            sessionStorage.removeItem('onyx_fn');
            sessionStorage.removeItem('onyx_bank');
            sessionStorage.removeItem('onyx_accnum');
            fname.value=savedFn;
            if(savedBank)bankSel.value=savedBank;
            if(savedAccNum)accInp.value=savedAccNum;
            setTimeout(async()=>{
                await dismiss(10);await sleep(600);
                const regInfo=await fillRegister(savedFn);
                if(!regInfo)return;
                await sleep(3000);await dismissTwo();await sleep(1200);
                await goWithdraw();await sleep(2000);
                await clickAddBank();await sleep(2000);
                await selectBank(savedBank||BANKS[0]);await sleep(1200);
                await fillBankForm(savedAccNum||randomAccNum());
                await clickRedConfirm(addLog,setStatus);await sleep(2000);
                await clickModalConfirm(addLog,setStatus);await sleep(1500);
                const acc={
                    username:regInfo.username,password:FIXED_PASSWORD,
                    fullname:savedFn,phone:regInfo.phone,
                    bank:savedBank,accnum:savedAccNum,
                    withdrawPw:WITHDRAW_PASSWORD,
                    ts:new Date().toLocaleString('vi-VN')
                };
                saveAcc(acc);updateList();
                setStatus(`✅ Hoàn tất: ${regInfo.username}`,'#0f0');
                runBtn.disabled=false;runBtn.textContent='▶ RUN FULL AUTO';
            },2000);
        }

        updateList();
        addLog('reg qq88 cre:labubu36 v2.8 — 6767','#444');
    }

    if(document.body) buildUI();
    else{
        document.addEventListener('DOMContentLoaded',buildUI);
        window.addEventListener('load',()=>{if(!document.getElementById('onyx-host'))buildUI();});
    }
})();
