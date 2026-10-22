// Real input edges, with a synthetic standard pad; no DOM renderer needed.
export default async function run({check, H}) {
  const {FlightInput} = await import(H.R + 'core/FlightInput.js');
  console.log('\nFlight speed brake input');
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const savedWindow = globalThis.window;
  let pad = null;
  Object.defineProperty(globalThis, 'navigator', {configurable:true, value:{getGamepads:()=>pad?[pad]:[]}});
  try {
    globalThis.window = {localStorage:{getItem:()=>null}};
    const f = new FlightInput({});
    const key = (code, repeat=false) => f._onKeyDown({code,repeat,preventDefault(){}});
    const poll = () => f.poll(1/60);
    key('KeyV'); poll();
    check(f.consumeAction('airbrake') && !f.consumeAction('airbrake'), 'V emits exactly one toggle');
    for(let i=0;i<120;i++){key('KeyV',true);poll();}
    check(!f.consumeAction('airbrake'), 'holding/repeating V never toggles again');
    f._onKeyUp({code:'KeyV'}); key('KeyV');
    check(f.consumeAction('airbrake'), 'release then press V emits the next toggle');
    f.suspended=true; key('KeyV');poll();
    check(!f.consumeAction('airbrake'), 'menu/pause input cannot toggle the brake');
    pad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    f.suspended=false;
    const button=(i,on)=>{pad.buttons[i]={pressed:on,value:on?1:0};poll();};
    button(1,true);
    check(f.consumeAction('airbrake'), 'unmodified gamepad B emits a toggle');
    for(let i=0;i<120;i++)poll();
    check(!f.consumeAction('airbrake'), 'holding gamepad B never toggles again');
    button(1,false);button(1,true);
    check(f.consumeAction('airbrake'), 'release then press gamepad B toggles again');
    button(1,false);button(8,true);button(1,true);
    check(f.consumeAction('mute') && !f.consumeAction('airbrake'), 'Back+B mutes without changing speed brakes');
    button(8,false);
    check(!f.consumeAction('airbrake') && !f.consumeAction('map'), 'releasing Back before held B triggers neither brake nor map');
    button(1,false);f.suspended=true;button(1,true);f.suspended=false;poll();
    check(!f.consumeAction('airbrake'), 'B held while closing a menu does not become a new press');
    button(1,false);button(1,true);
    check(f.consumeAction('airbrake'), 'B works again after a menu-held button is released');
    button(1,false);f.hangarAvailable=true;button(0,true);
    check(f.consumeAction('hangar') && !f.state.ab, 'A at the Hangar prompt enters without afterburner');
    button(0,false);f.hangarAvailable=false;button(0,true);
    check(f.state.ab && !f.consumeAction('hangar'), 'A away from a Hangar remains afterburner');
    f.suspended=true;poll();f.suspended=false;poll();
    check(!f.state.ab, 'menu confirmation held after departure cannot command afterburner');
    button(0,false);button(0,true);
    check(f.state.ab, 'afterburner works after releasing the menu confirmation');
    key('Enter');check(f.consumeAction('hangar'), 'Enter emits deliberate Hangar entry');
    f.clearActions();
  } finally {
    globalThis.window=savedWindow;
    if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;
  }
}
