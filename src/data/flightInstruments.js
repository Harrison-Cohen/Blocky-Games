// Display data, not flight tuning. A new aircraft selects a profile here and
// provides panel mounts in its cockpit builder. Unknown profiles use generic glass.
const NG = {ink:'#081014',text:'#e9eee2',dim:'#698384',green:'#6de5a2',cyan:'#69d5ef',magenta:'#e692ed',amber:'#ffc36b',red:'#ff786b',sky:'#317cab',ground:'#795332'};
const RAPTOR = {...NG,ink:'#07100d',text:'#b3f6a3',dim:'#487258',green:'#9bf48f',cyan:'#87dfca',magenta:'#d2e6a3',sky:'#163e36',ground:'#343b24'};
const panel=(id,type,parent,pos,size,view=[320,280])=>({id,type,parent,pos,size,view});
export const INSTRUMENT_PROFILES = {
  generic:{id:'generic',name:'Glass flight deck',kind:'glass',palette:NG,panels:[
    panel('flight','primary','panel',[.35,0,-.01],[.42,.37]),
    panel('navigation','navigation','panel',[-.12,0,-.01],[.42,.37]),
    panel('systems','systems','panel',[-.58,0,-.01],[.42,.37])]},
  '737ng':{id:'737ng',name:'737 NG',kind:'glass',palette:NG,panels:[
    panel('captain-pfd','primary','dash',[.75,.035,-.082],[.34,.36]),
    panel('captain-nd','navigation','dash',[.37,.035,-.082],[.34,.36]),
    panel('first-officer-pfd','primary','dash',[-.75,.035,-.082],[.34,.36]),
    panel('first-officer-nd','navigation','dash',[-.37,.035,-.082],[.34,.36]),
    panel('engines','engines','dash',[0,.055,-.082],[.33,.32]),
    panel('systems','systems','lower',[0,0,0],[.53,.265],[400,200]),
    panel('standby','standby','dash',[.87,-.235,-.083],[.24,.12],[320,100]),
    panel('mode-control','autopilot','mcp',[0,0,0],[1.20,.078],[600,56])]},
  raptor:{id:'raptor',name:'F-22',kind:'fighter',palette:RAPTOR,panels:[
    panel('head-up','hud','hud',[0,0,0],[.28,.20],[320,240]),
    panel('flight','primary','panel',[.31,.015,-.012],[.26,.245]),
    panel('navigation','navigation','panel',[0,.015,-.012],[.28,.265]),
    panel('engines','engines','panel',[-.31,.015,-.012],[.26,.245]),
    panel('systems','systems','panel',[0,-.195,-.012],[.55,.20],[400,200]),
    panel('mode-control','autopilot','panel',[.31,.225,-.012],[.24,.095],[320,110]),
    panel('status','status','panel',[-.31,.225,-.012],[.24,.095],[320,110])]},
};
export const instrumentProfile = (def) => INSTRUMENT_PROFILES[def.instrumentProfile] || INSTRUMENT_PROFILES.generic;
export const displayHeading = (rad) => ((Math.round(rad*180/Math.PI)%360)+360)%360;
export function instrumentScale(units) {
  return {speedStep:units==='metric'?40:20, altitudeStep:units==='metric'?100:200};
}
