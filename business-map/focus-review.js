(function(){
  const clean=v=>String(v??'').trim();
  function period(now=new Date()){
    const day=new Date(now.getTime()+9*60*60*1000);
    const month=day.toISOString().slice(0,7);
    day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);
    const monday=day.toISOString().slice(0,10);
    return {key:month+'/'+monday,label:`${Number(monday.slice(5,7))}/${Number(monday.slice(8,10))}週`};
  }
  function normalize(value){
    return {period:typeof value?.period==='string'?value.period:'',items:Array.from({length:3},(_,i)=>{
      const item=value?.items?.[i];
      return {text:clean(item?.text),answer:['yes','no'].includes(item?.answer)?item.answer:''};
    })};
  }
  function assess(person,now=new Date()){
    const current=period(now),review=normalize(person?.focusReview);
    const items=Array.from({length:3},(_,i)=>{
      const text=clean(person?.['focus'+(i+1)]),saved=review.items[i];
      return {text,answer:text&&review.period===current.key&&saved.text===text?saved.answer:''};
    });
    const active=items.filter(i=>i.text);
    return {...current,items,needed:active.some(i=>!i.answer),count:active.filter(i=>i.answer).length,total:active.length};
  }
  window.FocusReview={period,normalize,assess};
})();
