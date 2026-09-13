const WHATSAPP_MPROPS='5581997535560';
const PEDIDO_MINIMO=499;
const BRL=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const rawProducts=window.MPROPS_PRODUCTS||[];
const PAGE_SIZE=24;
const hasUsableImage=p=>Boolean(p&&typeof p.image==='string'&&p.image.trim());
const isPersonalizado=p=>Boolean(p?.customization||(p?.tags||[]).includes('personalizados'));
// A base completa permanece no catalog.js. Na vitrine entram apenas itens com foto aprovada,
// excluindo personalizados, conforme definição comercial do atacado.
const products=rawProducts
  .filter(p=>hasUsableImage(p)&&!isPersonalizado(p))
  .sort((a,b)=>Number(Boolean(b.bestseller))-Number(Boolean(a.bestseller)));
let filter='all',searchTerm='',visibleLimit=PAGE_SIZE;
const CUSTOMER_KEY='mpropsAtacadoCustomerV5',CART_KEY='mpropsAtacadoCartV5',LAST_KEY='mpropsAtacadoLastOrderV2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function safeParse(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
function attrsKey(attrs){return Object.entries(attrs||{}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}:${v}`).join('|')}
function attrsText(attrs){const e=Object.entries(attrs||{});return e.length?e.map(([k,v])=>`${k}: ${v}`).join(' • '):''}
function normalizeLegacyCart(items){return(Array.isArray(items)?items:[]).map((x,idx)=>{
  const attrs=x.attrs&&typeof x.attrs==='object'?x.attrs:(x.variation?{'Tamanho':x.variation}:{});
  return{key:x.key||`${x.id||'legacy-'+idx}|${attrsKey(attrs)}`,id:x.id||`legacy-${idx}`,name:x.name||'Produto MPROPS',attrs,qty:Math.max(1,Number(x.qty)||1),retail:Number(x.retail)||0,price:Number(x.price)||0,pieces:Math.max(1,Number(x.pieces)||1),image:x.image||''}
})}
let cart=normalizeLegacyCart(safeParse(localStorage.getItem(CART_KEY)||'[]',[]));

function axesOf(p){const keys=[];(p.variants||[]).forEach(v=>Object.keys(v.attributes||{}).forEach(k=>{if(!keys.includes(k))keys.push(k)}));return keys}
function uniqueAxis(p,key){return[...new Set((p.variants||[]).map(v=>v.attributes?.[key]).filter(v=>v!==undefined&&v!==null&&String(v)!==''))]}
function selectedAttrs(card,p){const attrs={};if(!card)return attrs;axesOf(p).forEach((k,i)=>{const el=card.querySelector(`[data-axis-index="${i}"]`);if(el)attrs[k]=el.value});return attrs}
function findVariant(p,attrs){if(!(p.variants||[]).length)return null;return p.variants.find(v=>Object.entries(v.attributes||{}).every(([k,val])=>attrs[k]===val))||null}
function effectiveRetail(p,attrs={}){const v=findVariant(p,attrs);return Number(v?.retail??p.retail)}
function half(v){return Math.round((Number(v)*.5)*100)/100}

function categoryLabel(p){const t=p.tags||[];if(t.includes('combos'))return'COMBOS';if(t.includes('femininos'))return'FEMININOS';if(t.includes('aco'))return'AÇO INOXIDÁVEL';if(t.includes('banhados'))return'BANHADOS A OURO';if(t.includes('pulseiras'))return'PULSEIRAS';if(t.includes('colares'))return'COLARES';return'ACESSÓRIOS'}
function metaText(p){const parts=[];if((p.pieces||1)>1)parts.push(`${p.pieces} peças no combo`);const axes=axesOf(p);if(axes.length)parts.push(axes.join(' • '));return parts.join(' • ')||'Produto selecionado MPROPS'}
function filterCopy(next){const map={
  all:['Produtos para revenda',`${products.length} produtos disponíveis para montar seu pedido.`],
  bestseller:['Mais vendidos','Os 10 primeiros modelos do ranking de vendas da MPROPS.'],
  colares:['Colares','Modelos selecionados para compor uma vitrine masculina versátil.'],
  pulseiras:['Pulseiras','Escolha os modelos e selecione o tamanho quando houver variação.'],
  aco:['Aço Inoxidável','Peças resistentes e versáteis para ampliar o seu catálogo de revenda.'],
  black:['Coleção Black','Acabamentos escuros e marcantes, uma das assinaturas da MPROPS.'],
  combos:['Combos','Conjuntos prontos para oferecer mais variedade com uma única escolha.'],
  banhados:['Banhados a Ouro','Acabamento dourado para diversificar a exposição da sua loja.'],
  femininos:['Femininos','Seleção feminina para complementar o seu mix de acessórios.']
};return map[next]||map.all}
function normalized(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function filteredProducts(){let list=products;if(filter!=='all')list=list.filter(p=>(p.tags||[]).includes(filter));if(searchTerm){const q=normalized(searchTerm);list=list.filter(p=>normalized(p.name).includes(q))}return list}
function setFilter(next){if(next==='kits'){document.getElementById('kits')?.scrollIntoView({behavior:'smooth',block:'start'});return}filter=next;visibleLimit=PAGE_SIZE;document.querySelectorAll('#categoryNav button').forEach(b=>b.classList.toggle('active',b.dataset.filter===next));const[title,sub]=filterCopy(next);document.getElementById('catalogTitle').textContent=title;document.getElementById('catalogSub').textContent=sub;renderProducts();document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth',block:'start'})}

function imageHTML(p){const badges=`${p.bestseller?'<span class="photo-badge">MAIS VENDIDO</span>':''}${(p.tags||[]).includes('combos')?'<span class="photo-badge gold" style="left:auto;right:10px">COMBO</span>':''}`;return`<div class="photo"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.remove()">${badges}</div>`}
function cardPriceUpdate(card,p){if(!card||!p)return;const attrs=selectedAttrs(card,p),retail=effectiveRetail(p,attrs),wholesale=half(retail),profit=retail-wholesale;card.querySelector('[data-wholesale]').textContent=BRL(wholesale);card.querySelector('[data-retail]').textContent=BRL(retail);card.querySelector('[data-profit]').textContent=BRL(profit)}
function renderProducts(){
  const list=filteredProducts(),shown=list.slice(0,visibleLimit),grid=document.getElementById('productGrid');if(!grid)return;
  if(!shown.length){grid.innerHTML='<div class="no-results">Nenhum produto encontrado para este filtro ou busca.</div>'}
  else grid.innerHTML=shown.map(p=>{
    const axes=axesOf(p),attrs={};axes.forEach(k=>attrs[k]=uniqueAxis(p,k)[0]);const retail=effectiveRetail(p,attrs),wholesale=half(retail),profit=retail-wholesale;
    const variantFields=axes.map((k,i)=>`<div class="field"><label>${esc(k).toUpperCase()}</label><select data-axis-index="${i}" data-product="${esc(p.id)}">${uniqueAxis(p,k).map(v=>`<option>${esc(v)}</option>`).join('')}</select></div>`).join('');
    return`<article class="card" data-id="${esc(p.id)}">${imageHTML(p)}<div class="card-body"><div class="cat">${categoryLabel(p)}</div><div class="name">${esc(p.name)}</div><div class="meta">${esc(metaText(p))}</div><div class="pricebox"><div class="prices"><div><div class="label">Preço atacado</div><div class="wholesale" data-wholesale>${BRL(wholesale)}</div></div><div class="retail"><small>PREÇO SUGERIDO</small><span data-retail>${BRL(retail)}</span></div></div><div class="profit">Lucro estimado: <strong data-profit>${BRL(profit)}</strong> por unidade</div></div>${variantFields}<div class="field"><label>QUANTIDADE</label><input data-qty type="number" min="1" step="1" inputmode="numeric" value="1"></div><button class="btn btn-gold btn-full" data-add="${esc(p.id)}">ADICIONAR AO CARRINHO</button></div></article>`
  }).join('');
  grid.querySelectorAll('select').forEach(el=>el.addEventListener('change',e=>{const card=e.target.closest('.card'),p=products.find(x=>x.id===card?.dataset.id);cardPriceUpdate(card,p)}));
  grid.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addToCart(b.dataset.add)));
  const count=document.getElementById('catalogCount');if(count)count.textContent=`${list.length} produto${list.length===1?'':'s'} · exibindo ${shown.length}`;
  const more=document.getElementById('loadMoreBtn');if(more)more.style.display=shown.length<list.length?'inline-flex':'none';
}

function snapshotCustomer(){const fields=[...document.querySelectorAll('[data-customer]')];if(!fields.length)return safeParse(localStorage.getItem(CUSTOMER_KEY)||'{}',{});const data=safeParse(localStorage.getItem(CUSTOMER_KEY)||'{}',{});fields.forEach(el=>data[el.dataset.customer]=el.value);localStorage.setItem(CUSTOMER_KEY,JSON.stringify(data));return data}
function restoreCustomer(){const data=safeParse(localStorage.getItem(CUSTOMER_KEY)||'{}',{});document.querySelectorAll('[data-customer]').forEach(el=>{if(data[el.dataset.customer]!=null)el.value=data[el.dataset.customer]})}
function bindCustomerEvents(){document.querySelectorAll('[data-customer]').forEach(el=>{el.addEventListener('input',snapshotCustomer);el.addEventListener('change',snapshotCustomer)})}
function save(){snapshotCustomer();localStorage.setItem(CART_KEY,JSON.stringify(cart));renderCart()}
function addToCart(id){const p=products.find(x=>x.id===id);if(!p)return;const card=[...document.querySelectorAll('.card')].find(x=>x.dataset.id===id);if(!card)return;const attrs=selectedAttrs(card,p);const variant=findVariant(p,attrs);if((p.variants||[]).length&&!variant){showToast('Selecione uma combinação disponível.');return}const qty=Math.max(1,parseInt(card.querySelector('[data-qty]')?.value||'1',10)||1);addCartItem(p,attrs,qty,variant);save();showToast();openCart()}
function addCartItem(p,attrs={},qty=1,variant=null){const retail=Number(variant?.retail??effectiveRetail(p,attrs)),key=p.id+'|'+attrsKey(attrs),ex=cart.find(i=>i.key===key);if(ex){ex.qty+=qty;if(!ex.image&&p.image)ex.image=p.image}else cart.push({key,id:p.id,name:p.name,attrs,qty,retail,price:half(retail),pieces:p.pieces||1,image:p.image||''})}
function changeQty(key,delta){const i=cart.find(x=>x.key===key);if(!i)return;i.qty+=delta;if(i.qty<=0)cart=cart.filter(x=>x.key!==key);save()}
function removeItem(key){cart=cart.filter(x=>x.key!==key);save()}
function clearCart(){cart=[];save()}
function totals(){let total=0,totalPieces=0,retail=0;cart.forEach(i=>{total+=Number(i.price||0)*Number(i.qty||0);totalPieces+=Number(i.pieces||1)*Number(i.qty||0);retail+=Number(i.retail||0)*Number(i.qty||0)});return{total,totalPieces,retail,profit:retail-total}}
function updateSummary(){const{totalPieces,total,retail,profit}=totals(),missing=Math.max(0,PEDIDO_MINIMO-total),ok=total>=PEDIDO_MINIMO,pct=Math.min(100,total/PEDIDO_MINIMO*100);const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};set('cartCount',totalPieces);set('itemsTotal',totalPieces);set('moneyTotal',BRL(total));set('retailTotal',BRL(retail));set('profitTotal',BRL(profit));set('missingValue',BRL(missing));const fill=document.getElementById('progressFill');if(fill)fill.style.width=pct+'%';const panel=document.getElementById('minimumPanel');if(panel){panel.className='minimum '+(ok?'ok':'pending');const st=panel.querySelector('strong');if(st)st.textContent=ok?'PEDIDO MÍNIMO ATINGIDO':'PEDIDO MÍNIMO AINDA NÃO ATINGIDO'}set('minimumMessage',ok?'Valor mínimo atingido. Complete os dados para enviar o pedido.':`Faltam ${BRL(missing)} para atingir o pedido mínimo.`);const status=document.getElementById('minimumStatus');if(status){status.className='status '+(ok?'ok':'pending');status.textContent=ok?'ATINGIDO':'NÃO ATINGIDO'}const btn=document.getElementById('sendOrderBtn');if(btn){btn.disabled=!ok;btn.textContent=ok?'ENVIAR PEDIDO PELO WHATSAPP':'PEDIDO MÍNIMO NÃO ATINGIDO'}}
function cartItemImage(x){return x.image||rawProducts.find(p=>p.id===x.id)?.image||''}
function renderCart(){const body=document.getElementById('cartBody');if(!body)return;if(!cart.length){body.innerHTML='<div class="empty">Seu carrinho está vazio.<br>Adicione produtos para montar o pedido.</div>';updateSummary();return}body.innerHTML=cart.map((x,idx)=>{const img=cartItemImage(x);return`<div class="cart-item"><div class="cart-item-main">${img?`<div class="cart-thumb"><img src="${esc(img)}" alt="${esc(x.name)}" loading="lazy" decoding="async"></div>`:''}<div class="cart-item-content"><div class="cart-item-top"><div><div class="cart-item-name">${esc(x.name)}</div><div class="cart-item-meta">${esc(attrsText(x.attrs))}${attrsText(x.attrs)?' • ':''}${x.pieces>1?x.pieces+' peças por combo':'1 peça por unidade'}</div></div><button class="remove" data-remove-index="${idx}">REMOVER</button></div><div class="cart-item-bottom"><div class="cart-qty"><button class="qtybtn" data-dec-index="${idx}">−</button><strong>${x.qty}</strong><button class="qtybtn" data-inc-index="${idx}">+</button></div><strong class="cart-item-subtotal">${BRL(x.qty*x.price)}</strong></div></div></div></div>`}).join('')+checkoutHTML();body.querySelectorAll('[data-remove-index]').forEach(b=>b.addEventListener('click',()=>removeItem(cart[Number(b.dataset.removeIndex)].key)));body.querySelectorAll('[data-dec-index]').forEach(b=>b.addEventListener('click',()=>changeQty(cart[Number(b.dataset.decIndex)].key,-1)));body.querySelectorAll('[data-inc-index]').forEach(b=>b.addEventListener('click',()=>changeQty(cart[Number(b.dataset.incIndex)].key,1)));restoreCustomer();bindCustomerEvents();updateSummary()}
function checkoutHTML(){return`<div class="checkout" id="checkout"><h4>Dados do cliente e envio</h4><div class="checkout-sub">Preencha os dados para enviar o pedido completo à equipe MPROPS.</div><div id="validationBox" class="validation"></div><div class="checkout-form"><input data-customer="nome" id="cNome" class="full" placeholder="Nome completo *"><input data-customer="cpf" id="cCpf" placeholder="CPF *"><input data-customer="whats" id="cWhats" placeholder="WhatsApp *"><input data-customer="email" id="cEmail" class="full" placeholder="E-mail *"><input data-customer="cep" id="cCep" placeholder="CEP *"><input data-customer="uf" id="cUf" placeholder="UF *"><input data-customer="cidade" id="cCidade" placeholder="Cidade *"><input data-customer="bairro" id="cBairro" placeholder="Bairro *"><input data-customer="endereco" id="cEndereco" class="full" placeholder="Endereço *"><input data-customer="numero" id="cNumero" placeholder="Número *"><input data-customer="comp" id="cComp" placeholder="Complemento"><select data-customer="pagamento" id="cPagamento" class="full"><option value="">Forma de pagamento *</option><option>Pix</option><option>Crédito em 2x sem juros</option></select><textarea data-customer="obs" id="cObs" class="full" placeholder="Observações do pedido"></textarea></div><button id="sendOrderBtn" class="btn wa-btn btn-full" onclick="sendWhatsApp()">ENVIAR PEDIDO PELO WHATSAPP</button></div>`}
function f(id){return(document.getElementById(id)?.value||'').trim()}
function validateCustomer(){const req=[['cNome','Nome completo'],['cCpf','CPF'],['cWhats','WhatsApp'],['cEmail','E-mail'],['cCep','CEP'],['cEndereco','Endereço'],['cNumero','Número'],['cBairro','Bairro'],['cCidade','Cidade'],['cUf','UF'],['cPagamento','Forma de pagamento']];document.querySelectorAll('.field-error').forEach(e=>e.classList.remove('field-error'));const miss=[];req.forEach(([id,label])=>{const el=document.getElementById(id);if(!f(id)){miss.push(label);el?.classList.add('field-error')}});const box=document.getElementById('validationBox');if(miss.length){if(box){box.classList.add('show');box.innerHTML='<strong>FALTA PREENCHER:</strong><br>'+miss.map(x=>'• '+esc(x)).join('<br>');box.scrollIntoView({behavior:'smooth',block:'center'})}return false}box?.classList.remove('show');return true}
function sendWhatsApp(){const{totalPieces,total,retail,profit}=totals();if(!cart.length||total<PEDIDO_MINIMO){showToast('O pedido mínimo ainda não foi atingido.');return}snapshotCustomer();if(!validateCustomer())return;const lines=['Olá, quero solicitar um pedido no MPROPS ATACADO.','','ITENS DO PEDIDO:'];cart.forEach((x,i)=>{lines.push(`${i+1}. ${x.name}`);Object.entries(x.attrs||{}).forEach(([k,v])=>lines.push(`${k}: ${v}`));lines.push(`Quantidade: ${x.qty}`,`Peças contabilizadas: ${(x.pieces||1)*x.qty}`,`Subtotal atacado: ${BRL(x.qty*x.price)}`,`Preço sugerido unitário: ${BRL(x.retail)}`)});lines.push('',`TOTAL DE PEÇAS: ${totalPieces}`,`TOTAL DO PEDIDO: ${BRL(total)}`,`VENDA SUGERIDA TOTAL: ${BRL(retail)}`,`LUCRO ESTIMADO: ${BRL(profit)}`,'',`PAGAMENTO: ${f('cPagamento')}`,'FRETE: GRÁTIS NO PRIMEIRO PEDIDO','','DADOS DO CLIENTE:',`Nome: ${f('cNome')}`,`CPF: ${f('cCpf')}`,`WhatsApp: ${f('cWhats')}`,`E-mail: ${f('cEmail')}`,'','ENVIO:',`CEP: ${f('cCep')}`,`Endereço: ${f('cEndereco')}, ${f('cNumero')}`,`Complemento: ${f('cComp')||'-'}`,`Bairro: ${f('cBairro')}`,`Cidade/UF: ${f('cCidade')}/${f('cUf')}`,`Observações: ${f('cObs')||'-'}`);localStorage.setItem(LAST_KEY,JSON.stringify({cart,customer:safeParse(localStorage.getItem(CUSTOMER_KEY)||'{}',{}),date:new Date().toISOString()}));window.open(`https://wa.me/${WHATSAPP_MPROPS}?text=`+encodeURIComponent(lines.join('\n')),'_blank','noopener')}
function repeatLastOrder(){const last=safeParse(localStorage.getItem(LAST_KEY)||'null',null);let lastCart=null,lastCustomer=null;if(Array.isArray(last))lastCart=last;else if(last?.cart?.length){lastCart=last.cart;lastCustomer=last.customer}if(!lastCart?.length){showToast('Nenhum pedido anterior salvo neste navegador.');return}cart=normalizeLegacyCart(lastCart);localStorage.setItem(CART_KEY,JSON.stringify(cart));if(lastCustomer)localStorage.setItem(CUSTOMER_KEY,JSON.stringify(lastCustomer));renderCart();openCart();showToast('Último pedido restaurado.')}

const presetPlans={
  starter:[
    ['Colar Masculino Ponta de Lança Black',4],['Colar Masculino Crucifixo Black',3],['Colar Masculino Identidade Black',3],['Colar Masculino Dez Mandamentos Black',3],['Pulseira Masculina Tiras Black',3],['Pulseira Masculina Trançada Total Black',3],['Pulseira Masculina Pai Nosso Black',3],['Pulseira Masculina Pedra Natural Ônix Fosco 8mm',3]
  ],
  best:[
    ['Colar Masculino Ponta de Lança Black',4],['Colar Masculino Crucifixo Black',4],['Colar Masculino Identidade Black',4],['Colar Masculino Dez Mandamentos Black',4],['Colar Masculino São Bento Black',4],['Colar Masculino Explore Black',3],['Pulseira Masculina Fé + Força + Coragem Black',3],['Pulseira Masculina Tiras Black',3],['Pulseira Masculina Trançada Total Black',3],['Pulseira Masculina Pai Nosso Black',3]
  ],
  black:[
    ['Colar Masculino Ponta de Lança Black',4],['Colar Masculino Crucifixo Black',4],['Colar Masculino Identidade Black',4],['Colar Masculino Dez Mandamentos Black',4],['Colar Masculino São Bento Black',4],['Colar Masculino Explore Black',4],['Colar Masculino Fé Black',4],['Colar Masculino Âncora Black',4],['Pulseira Masculina Fé + Força + Coragem Black',4],['Pulseira Masculina Tiras Black',4],['Pulseira Masculina Trançada Total Black',3],['Pulseira Masculina Pai Nosso Black',3]
  ],
  plus:[
    ['Colar Masculino Ponta de Lança Black',4],['Colar Masculino Crucifixo Black',4],['Colar Masculino Identidade Black',4],['Colar Masculino Dez Mandamentos Black',4],['Colar Masculino São Bento Black',4],['Colar Masculino Explore Black',4],['Colar Masculino Fé Black',4],['Colar Masculino Âncora Black',4],['Colar Masculino Cruz de Santiago Black',4],['Colar Masculino Dez Mandamentos Graphite',3],['Pulseira Masculina Fé + Força + Coragem Black',3],['Pulseira Masculina Tiras Black',3],['Pulseira Masculina Trançada Total Black',3],['Pulseira Masculina Pai Nosso Black',3],['Pulseira Masculina Pedra Natural Ônix Fosco 8mm',3],['Pulseira Masculina Rope Black',3],['Pulseira Masculina Trançada Black',3]
  ]
};
function addPreset(type){const plan=presetPlans[type]||[];let missing=0;plan.forEach(([name,qty])=>{const p=products.find(x=>x.name===name);if(!p){missing++;return}const attrs={};axesOf(p).forEach(k=>attrs[k]=uniqueAxis(p,k)[0]);addCartItem(p,attrs,qty,findVariant(p,attrs))});save();openCart();showToast(missing?'Kit adicionado com os itens disponíveis.':'Kit adicionado ao carrinho.')}
function askQuestion(){window.open(`https://wa.me/${WHATSAPP_MPROPS}?text=`+encodeURIComponent('Olá, tenho uma dúvida sobre o MPROPS ATACADO.'),'_blank','noopener')}
function openCart(){document.getElementById('cart')?.classList.add('open');document.getElementById('overlay')?.classList.add('show');document.body.style.overflow='hidden';restoreCustomer()}
function closeCart(){snapshotCustomer();document.getElementById('cart')?.classList.remove('open');document.getElementById('overlay')?.classList.remove('show');document.body.style.overflow=''}
function showToast(msg='Produto adicionado ao carrinho.'){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function syncCategoryNav(){document.querySelectorAll('#categoryNav button').forEach(b=>{const key=b.dataset.filter;if(!key||key==='all'||key==='kits'){b.dataset.empty='false';return}const has=products.some(p=>(p.tags||[]).includes(key));b.dataset.empty=has?'false':'true'})}

document.querySelectorAll('#categoryNav button').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
document.getElementById('catalogSearch')?.addEventListener('input',e=>{searchTerm=e.target.value.trim();visibleLimit=PAGE_SIZE;renderProducts()});
function loadMoreProducts(){const total=filteredProducts().length;if(visibleLimit>=total)return;visibleLimit=Math.min(visibleLimit+PAGE_SIZE,total);renderProducts()}
document.getElementById('loadMoreBtn')?.addEventListener('click',loadMoreProducts);
syncCategoryNav();restoreCustomer();renderProducts();renderCart();
