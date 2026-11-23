(() => {
  'use strict';
  const tools=window.WingmanTools ||= {};
  const softTrims=['5x8','5.06x7.81','5.25x8','5.5x8.5','6x9','6.14x9.21','6.69x9.61','7x10','7.44x9.69','7.5x9.25','8x10','8.25x6','8.25x8.25','8.5x8.5','8.5x11','8.27x11.69'];
  const hardTrims=['5.5x8.5','6x9','6.14x9.21','7x10','8.25x11'];
  const stocks={white:['Druk czarno-biały, papier biały',.002252],cream:['Druk czarno-biały, papier kremowy',.0025],
    standard:['Kolor standardowy',.002252],premium:['Kolor premium',.002347]};
  const round=n=>Math.round(n*1000)/1000;
  function limits(binding,trim,stock) {
    if(binding==='hard') return [76,550];
    if(stock==='standard') return [72,trim==='8.27x11.69'?0:600];
    const [w]=trim.split('x').map(Number);
    const limits=w===8.5?[590,550,590]:w===8.27?[780,730,590]:w===8.25?[800,750,800]:[828,776,828];
    return [24,limits[{white:0,cream:1,premium:2}[stock]]];
  }
  function dimensions(binding,trim,stock,pages) {
    const [w,h]=trim.split('x').map(Number);
    const bookBlock=stocks[stock][1]*pages;
    if(binding==='soft') return {width:2*w+bookBlock+.25, height:h+.25, spine:bookBlock, edge:.125, hinge:0};
    // Case laminate: 15 mm folds, 5 mm board extension per side, 6 mm total board height extension.
    return {width:round(2*w+bookBlock+44.8/25.4), height:round(h+36/25.4),spine:round(bookBlock+4.8/25.4),edge:15/25.4,hinge:10/25.4};
  }
  function template(d,pages) {
    const {width:w,height:h,spine,edge,hinge}=d, left=(w-spine)/2, right=left+spine;
    const safe=edge+.125, innerLeft=left-hinge-.125, safeWidth=innerLeft-safe;
    const rect=(x,y,width,height,attrs)=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" ${attrs}/>`;
    const label=(x,y,txt,size=.15)=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#554754" font-family="Arial,sans-serif">${txt}</text>`;
    const line=(x,stroke)=>`<path d="M ${x} 0 V ${h}" stroke="${stroke}" stroke-width=".012" stroke-dasharray=".07 .035"/>`;
    const guide='fill="none" stroke="#577e74" stroke-width=".012" stroke-dasharray=".065 .035"';
    const barcodeX=left-hinge-.25-2, barcodeY=h-(hinge?.76:edge+.25)-1.2;
    let shapes=rect(0,0,w,h,'fill="#f5e7ee"')+rect(edge,edge,w-2*edge,h-2*edge,'fill="#fff" stroke="#a0134a" stroke-width=".014"');
    if(hinge) shapes+=rect(left-hinge,edge,spine+2*hinge,h-2*edge,'fill="#f6f0e4"');
    shapes+=rect(safe,safe,safeWidth,h-2*safe,guide)+rect(right+hinge+.125,safe,safeWidth,h-2*safe,guide)
      +line(left,'#a0134a')+line(right,'#a0134a');
    if (pages>=80 && spine>.125) shapes+=rect(left+.0625,safe,spine-.125,h-2*safe,guide);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}" role="img" aria-label="Szablon okładki z liniami cięcia, bezpiecznym obszarem, grzbietem i miejscem na kod kreskowy">
      ${shapes}${label((edge+left)/2,h/2,'TYŁ')}${label((right+w-edge)/2,h/2,'PRZÓD')}
      ${rect(barcodeX,barcodeY,2,1.2,'fill="#fff" stroke="#595661" stroke-width=".012"')}${label(barcodeX+1,barcodeY+.65,'Kod kreskowy',.12)}</svg>`;
  }
  function saveBlob(blob,name) {
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url; link.download=name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  // Canvas encoders default to 96 ppi. Embed 300 ppi so layout software
  // imports the template at its physical trim size as well as its pixel size.
  async function setPrintResolution(blob) {
    const bytes=new Uint8Array(await blob.arrayBuffer()), source=new DataView(bytes.buffer);
    const phys=new Uint8Array(21), view=new DataView(phys.buffer);
    view.setUint32(0,9); phys.set([112,72,89,115],4);
    view.setUint32(8,11811); view.setUint32(12,11811); phys[16]=1;
    let crc=0xffffffff;
    for(const byte of phys.subarray(4,17)) {
      crc^=byte;
      for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
    }
    view.setUint32(17,(crc^0xffffffff)>>>0);
    const parts=[bytes.subarray(0,8)];
    for(let pos=8;pos<bytes.length;) {
      const length=source.getUint32(pos),type=source.getUint32(pos+4),end=pos+length+12;
      if(type!==0x70485973) parts.push(bytes.subarray(pos,end));
      if(type===0x49484452) parts.push(phys);
      pos=end;
    }
    return new Blob(parts,{type:'image/png'});
  }
  async function asPng(svg,d) {
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const image=new Image(); image.src=url; await image.decode();
      const canvas=document.createElement('canvas'); canvas.width=Math.round(d.width*300); canvas.height=Math.round(d.height*300);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob) throw new Error('PNG');
      return setPrintResolution(blob);
    } finally {URL.revokeObjectURL(url);}
  }
  function coverTool(root) {
    root.innerHTML=`<form class="tool-form"><label>Oprawa<select name="binding"><option value="soft">Miękka</option><option value="hard">Twarda (case laminate)</option></select></label>
      <label>Papier i druk<select name="stock">${Object.entries(stocks).map(([k,[label]])=>`<option value="${k}">${label}</option>`).join('')}</select></label>
      <label>Format po przycięciu (cale)<select name="trim"></select></label><label>Liczba stron w druku<input name="pages" type="number" step="1" value="120" required></label>
      <button>Oblicz wymiary</button></form><div class="result" aria-live="polite"></div>
      <p><a href="https://kdp.amazon.com/en_US/cover-templates" target="_blank" rel="noopener">Oficjalny kalkulator okładek KDP</a></p>`;
    const form=root.querySelector('form'), f=form.elements, result=root.querySelector('.result');
    function prepare() {
      const hard=f.binding.value==='hard', trims=hard?hardTrims:softTrims;
      const selection=trims.includes(f.trim.value)?f.trim.value:'6x9';
      f.trim.innerHTML=trims.map(t=>`<option value="${t}">${t.replace('x',' × ')}</option>`).join('');
      f.trim.value=selection;
      const standard=f.stock.querySelector('[value="standard"]');
      standard.disabled=hard || selection==='8.27x11.69';
      if(standard.disabled && f.stock.value==='standard') f.stock.value='white';
      [f.pages.min,f.pages.max]=limits(f.binding.value,selection,f.stock.value);
    }
    function show() {
      if(!form.checkValidity()) return;
      const d=dimensions(f.binding.value,f.trim.value,f.stock.value,+f.pages.value), svg=template(d,+f.pages.value);
      const name=`wingman-okladka-${f.binding.value}-${f.trim.value}-${f.stock.value}-${f.pages.value}str`;
      const fmt=n=>n.toLocaleString('pl-PL',{maximumFractionDigits:4});
      const measurements=[['Szerokość okładki',d.width],['Wysokość okładki',d.height],['Szerokość grzbietu',d.spine]];
      const titansNote=f.stock.value==='standard'
        ? `<details><summary>Porównaj grzbiet z Self Publishing Titans</summary><p>Przy ${Number(f.pages.value)} stronach Titans pokazuje ${fmt(Number(f.pages.value)*.00225)}″. W szablonie stosujemy współczynnik KDP dla koloru standardowego (0,002252″ na stronę).</p></details>` : '';
      result.innerHTML=`<div style="overflow:auto"><table><thead><tr><th>Wymiar</th><th>Cale</th><th>cm</th><th>px (300 ppi)</th><th>pt</th></tr></thead><tbody>
        ${measurements.map(([label,v])=>`<tr><th scope="row">${label}</th><td>${fmt(v)}</td><td>${fmt(v*2.54)}</td><td>${Math.round(v*300)}</td><td>${fmt(v*72)}</td></tr>`).join('')}
        </tbody></table></div><div data-preview></div><p>Bordo oznacza krawędzie i grzbiet. Zielone obrysy wyznaczają bezpieczne pole tekstu. Usuń warstwę szablonu z gotowej okładki.</p>
        <button type="button" data-download-svg>Pobierz SVG</button> <button type="button" data-download-png>Pobierz PNG</button><p role="status" data-export-status></p>${titansNote}`;
      const preview=result.querySelector('[data-preview]');
      preview.innerHTML=svg;
      Object.assign(preview.firstElementChild.style,{width:'100%',height:'auto',maxHeight:'400px'});
      result.querySelector('[data-download-svg]').onclick=()=>saveBlob(new Blob([svg],{type:'image/svg+xml'}),name+'.svg');
      result.querySelector('[data-download-png]').onclick=async(event)=>{
        const button=event.currentTarget;button.disabled=true;
        try { const png=await asPng(svg,d); saveBlob(png,name+'.png'); }
        catch {result.querySelector('[data-export-status]').textContent='Eksport PNG nie powiódł się. Możesz pobrać szablon w formacie SVG.';}
        finally {button.disabled=false;}
      };
    }
    form.addEventListener('input',()=>{prepare();result.replaceChildren();});
    form.addEventListener('submit',event=>{event.preventDefault();show();});
    prepare();show();
  }
  tools.cover=coverTool;
  if(typeof module!=='undefined' && module.exports) module.exports={limits,dimensions,template};
})();
