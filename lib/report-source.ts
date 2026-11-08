// Reads through the authenticated data client and its tenant filters, never a privileged client.
export async function loadReportRows(client: any, businessId: string) {
  const readAll=async(table:'accounts'|'journal_entries')=>{
    const rows:any[]=[],seen=new Set<string>();
    for(let offset=0;;) {
      let query=client.from(table).select(table==='accounts'?'*':'id,business_id,journal_no,journal_date,description,status,source_type,created_at,journal_lines(*)').eq('business_id',businessId);
      if(table==='journal_entries')query=query.eq('status','POSTED');
      query=query.order(table==='accounts'?'code':'journal_date',{ascending:true}).order('id',{ascending:true});
      const page=await query.range(offset,offset+499);
      if(page.error)throw new Error(page.error.message);
      if(!Array.isArray(page.data))throw new Error('Report data is unavailable. Retry the report.');
      if(!page.data.length)return rows;
      for(const row of page.data){
        if(row.business_id!==businessId||(table==='journal_entries'&&row.status!=='POSTED')||typeof row.id!=='string'||seen.has(row.id))throw new Error('Report data changed or is outside this business. Reload the report.');
        seen.add(row.id);rows.push(row);
      }
      offset+=page.data.length;
    }
  };
  const [accounts,journals]=await Promise.all([readAll('accounts'),readAll('journal_entries')]);
  return {accounts,journals};
}
