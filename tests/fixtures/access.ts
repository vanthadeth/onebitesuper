import {defaultGrants, type AccessState} from "../../packages/core/src/access.ts";
export function initialAccessState(): AccessState {
  return {version:1,sites:[{id:0,name:"Riverside",active:true},{id:1,name:"Neighborhood",active:true},{id:2,name:"Street corner",active:true}],grants:defaultGrants(),events:[],users:[
    {id:"owner",name:"Dara",username:"dara",role:"Owner",sites:[],active:true},
    {id:"supervisor",name:"Vannak",username:"vannak",role:"Supervisor",sites:[0,1],active:true},
    {id:"sokha",name:"Sokha",username:"sokha",role:"Cashier",sites:[0],active:true},
    {id:"srey",name:"Sreypov",username:"sreypov",role:"Cashier",sites:[0,2],active:true},
    {id:"chan",name:"Chantha",username:"chantha",role:"Cashier",sites:[1],active:true},
    {id:"pisey",name:"Pisey",username:"pisey",role:"Cashier",sites:[2],active:true},
  ]};
}
