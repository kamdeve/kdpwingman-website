function confirmationPages(success, dashboard) {
  const scripts=[];
  const panel=dashboard.replace(/<script>([\s\S]*?)<\/script>/gi,(_,source)=>{
    scripts.push(source);
    return '';
  }).replace('</body>','<script src="/dashboard-app.js"></script></body>');
  return {
    '/dashboard.html':panel,
    '/dashboard-app.js':scripts.join('\n'),
    '/success.html':success.replace('<html lang="pl">','<html lang="pl" data-enrollment="pending">')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
      .replace('</body>','<script src="/enrollment-success.js"></script></body>')
  };
}
module.exports=confirmationPages;
