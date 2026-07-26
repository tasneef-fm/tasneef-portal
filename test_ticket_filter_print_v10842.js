const fs=require('fs'),vm=require('vm');
const full=fs.readFileSync('/mnt/data/work_v10842/app.js','utf8');
const start=full.indexOf('/* ===== V10842:');
if(start<0) throw new Error('V10842 module missing');
const code=full.slice(start);
const mk=(o={})=>Object.assign({dataset:{},addEventListener(){},selectedOptions:[]},o);
const elements={
  ticketsBody:mk(),
  ticketFilterProjectV10842:mk({value:'2',innerHTML:''}),
  ticketFilterFromV10801:mk({value:'2026-07-02'}),
  ticketFilterToV10801:mk({value:'2026-07-03'}),
  ticketFilterReceiveV10801:mk({value:''}),
  ticketFilterStatus:mk({value:''}),
  ticketSearch:mk({value:''}),
  ticketSortOrder:mk({value:'oldest'}),
  ticketPrintFilteredV10842:mk({textContent:'',onclick:null})
};
const document={
  getElementById:id=>elements[id]||null,
  addEventListener:()=>{},
  querySelectorAll:()=>[],
  createElement:()=>({dataset:{},addEventListener(){},className:'',appendChild(){}})
};
let rendered=[];
const window={
  data:{
    projects:[{id:1,name:'صفاء 28'},{id:2,name:'صفاء 65'}],
    tickets:[
      {id:1,project_id:1,created_at:'2026-07-02T08:00:00+03:00',status:'open',title:'A'},
      {id:2,project_id:2,created_at:'2026-07-01T23:30:00Z',status:'open',title:'B'}, // Riyadh 07-02
      {id:3,project_id:2,created_at:'2026-07-03T20:00:00Z',status:'closed',title:'C'}, // Riyadh 07-03 23:00
      {id:4,project_id:2,created_at:'2026-07-04T00:30:00+03:00',status:'open',title:'D'}
    ]
  },
  renderTickets:async()=>{rendered=window.data.tickets.map(x=>x.id)},
  projectName:id=>window.data.projects.find(p=>String(p.id)===String(id))?.name||'-',
  supervisorName:()=>'-',
  msg:()=>{},
  open:()=>null,
  addEventListener:()=>{}
};
const context={window,document,console,Intl,Date,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{},alert:()=>{}};
vm.createContext(context);vm.runInContext(code,context);
(async()=>{
  await window.renderTickets();
  const ids=window.getFilteredTicketsV10842().map(x=>x.id);
  if(JSON.stringify(rendered)!==JSON.stringify([2,3])) throw new Error('render mismatch '+JSON.stringify(rendered));
  if(JSON.stringify(ids)!==JSON.stringify([2,3])) throw new Error('filter mismatch '+JSON.stringify(ids));
  if(window.data.tickets.length!==4) throw new Error('source not restored');
  elements.ticketFilterProjectV10842.value='1';
  await window.renderTickets();
  if(JSON.stringify(rendered)!==JSON.stringify([1])) throw new Error('project switch mismatch '+JSON.stringify(rendered));
  console.log('V10842 logic tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
