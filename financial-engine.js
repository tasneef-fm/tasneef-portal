
'use strict';
(() => {
  const defaults = {taxRate:0.15,defaultPriceMode:'exclusive',minimumProfitPercent:0,deliveryTaxable:true,extrasTaxable:true,currency:'SAR',locale:'ar-SA'};
  let config={...defaults};
  const n=value=>{if(value===null||value===undefined||value==='')return 0;const x=String(value).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,]/g,'').replace('٫','.').trim();const v=Number(x);return Number.isFinite(v)?v:0;};
  const round=(value,digits=2)=>{const f=10**digits;return Math.round((n(value)+Number.EPSILON)*f)/f;};
  const mode=value=>['inclusive','exclusive','exempt'].includes(value)?value:config.defaultPriceMode;
  const format=value=>new Intl.NumberFormat(config.locale,{style:'currency',currency:config.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(round(value));
  function line(input={}){
    const qty=Math.max(0,n(input.qty||0)),inputPrice=Math.max(0,n(input.unitPrice??input.unit_price??0));
    const rate=Math.max(0,n(input.taxRate??input.tax_rate??config.taxRate)),priceMode=mode(input.priceMode??input.price_input_mode);
    const unitBeforeTax=priceMode==='inclusive'&&rate>0?inputPrice/(1+rate):inputPrice,grossBeforeTax=qty*unitBeforeTax;
    const discountType=input.discountType??input.discount_type??'fixed',discountValue=Math.max(0,n(input.discountValue??input.discount_value??input.discount??0));
    const discount=Math.min(grossBeforeTax,discountType==='percent'?grossBeforeTax*discountValue/100:discountValue);
    const beforeTax=Math.max(0,grossBeforeTax-discount),taxable=priceMode!=='exempt',tax=taxable?beforeTax*rate:0,total=beforeTax+tax;
    const cost=qty*Math.max(0,n(input.cost??input.unit_cost??0));
    return {qty:round(qty,3),inputPrice:round(inputPrice,4),unitBeforeTax:round(unitBeforeTax,4),grossBeforeTax:round(grossBeforeTax),discount:round(discount),beforeTax:round(beforeTax),tax:round(tax),total:round(total),cost:round(cost),taxable,priceMode,taxRate:rate};
  }
  function documentCalc(input={}){
    const lines=(input.lines||[]).map(line),subtotalGross=lines.reduce((s,x)=>s+x.grossBeforeTax,0),lineDiscount=lines.reduce((s,x)=>s+x.discount,0),afterLineDiscount=lines.reduce((s,x)=>s+x.beforeTax,0);
    const invoiceDiscountType=input.invoiceDiscountType??input.invoice_discount_type??'fixed',invoiceDiscountValue=Math.max(0,n(input.invoiceDiscountValue??input.invoice_discount_value??input.invoiceDiscount??input.invoice_discount??0));
    const invoiceDiscount=Math.min(afterLineDiscount,invoiceDiscountType==='percent'?afterLineDiscount*invoiceDiscountValue/100:invoiceDiscountValue),ratio=afterLineDiscount>0?Math.max(0,1-invoiceDiscount/afterLineDiscount):1;
    const taxableLines=lines.filter(x=>x.taxable).reduce((s,x)=>s+x.beforeTax,0)*ratio,exemptLines=lines.filter(x=>!x.taxable).reduce((s,x)=>s+x.beforeTax,0)*ratio;
    const delivery=Math.max(0,n(input.deliveryFee??input.delivery_fee??0)),extras=Math.max(0,n(input.extrasTotal??input.extras_total??0)),rate=Math.max(0,n(input.taxRate??input.tax_rate??config.taxRate));
    const deliveryTaxable=input.deliveryTaxable??input.delivery_taxable??config.deliveryTaxable,extrasTaxable=input.extrasTaxable??input.extras_taxable??config.extrasTaxable;
    const taxableBase=taxableLines+(deliveryTaxable?delivery:0)+(extrasTaxable?extras:0),exemptBase=exemptLines+(deliveryTaxable?0:delivery)+(extrasTaxable?0:extras);
    const beforeTax=taxableBase+exemptBase,tax=taxableBase*rate,total=beforeTax+tax,paid=Math.max(0,n(input.paid??input.paid_amount??0)),remaining=Math.max(0,total-paid);
    const itemCost=lines.reduce((s,x)=>s+x.cost,0),directCost=Math.max(0,n(input.directCost??input.direct_cost??0)),totalCost=itemCost+directCost,profit=beforeTax-totalCost,margin=beforeTax>0?profit/beforeTax*100:0;
    return {lines,subtotalGross:round(subtotalGross),lineDiscount:round(lineDiscount),invoiceDiscount:round(invoiceDiscount),totalDiscount:round(lineDiscount+invoiceDiscount),delivery:round(delivery),extras:round(extras),taxableBase:round(taxableBase),exemptBase:round(exemptBase),beforeTax:round(beforeTax),tax:round(tax),total:round(total),paid:round(paid),remaining:round(remaining),itemCost:round(itemCost),directCost:round(directCost),totalCost:round(totalCost),profit:round(profit),margin:round(margin),taxRate:rate};
  }
  function summaryHtml(id='financialSummary'){return `<section class="financial-summary" id="${id}"><div><span>الإجمالي قبل الخصم</span><b data-f="subtotalGross">0.00 ر.س</b></div><div><span>إجمالي الخصومات</span><b data-f="totalDiscount">0.00 ر.س</b></div><div><span>قبل الضريبة</span><b data-f="beforeTax">0.00 ر.س</b></div><div><span>الضريبة</span><b data-f="tax">0.00 ر.س</b></div><div class="grand"><span>الإجمالي شامل الضريبة</span><b data-f="total">0.00 ر.س</b></div><div><span>المدفوع</span><b data-f="paid">0.00 ر.س</b></div><div><span>المتبقي</span><b data-f="remaining">0.00 ر.س</b></div><div data-financial-only><span>التكلفة</span><b data-f="totalCost">0.00 ر.س</b></div><div data-financial-only><span>صافي الربح</span><b data-f="profit">0.00 ر.س</b></div><div data-financial-only><span>هامش الربح</span><b data-f="margin">0.00%</b></div></section>`;}
  function paint(root,result,showFinancial=true){if(!root)return;root.querySelectorAll('[data-f]').forEach(el=>{const k=el.dataset.f;el.textContent=k==='margin'?`${round(result[k])}%`:format(result[k]);});root.querySelectorAll('[data-financial-only]').forEach(el=>el.hidden=!showFinancial);root.classList.toggle('loss-warning',result.profit<0);}
  async function load(){try{const r=await window.WardatBackend?.request('/api/settings/financial',{skipPermissionCheck:true});if(r)config={...config,taxRate:n(r.tax_rate??config.taxRate),defaultPriceMode:mode(r.default_price_mode),minimumProfitPercent:n(r.minimum_profit_percent),deliveryTaxable:Boolean(r.delivery_taxable),extrasTaxable:Boolean(r.extras_taxable),currency:r.currency||config.currency};}catch{}return {...config};}
  window.WardatFinancial={n,round,format,line,document:documentCalc,summaryHtml,paint,load,get config(){return {...config};},setConfig(next={}){config={...config,...next};}};
})();
