$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class NexusTsRead {
 [StructLayout(LayoutKind.Sequential)] public struct SI { public int Id; public IntPtr Name; public int State; }
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct INFO {
  public int State,Id,IncomingBytes,OutgoingBytes,IncomingFrames,OutgoingFrames,IncomingCompressedBytes,OutgoingCompressedBytes;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)] public string Station;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=17)] public string Domain;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=21)] public string User;
  public long ConnectTime,DisconnectTime,LastInputTime,LogonTime,CurrentTime;
 }
 [DllImport("wtsapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool WTSEnumerateSessions(IntPtr h,int r,int v,out IntPtr p,out int count);
 [DllImport("wtsapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool WTSQuerySessionInformation(IntPtr h,int id,int cls,out IntPtr p,out int bytes);
 [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr p);
 public class Row {public int id; public string user,domain,state,logonAt,disconnectedAt,clientName,clientAddress; public long? disconnectedSeconds;}
 static string Stamp(long t) {try {return t>0?DateTime.FromFileTimeUtc(t).ToString("o"):null;} catch{return null;}}
 static string Text(int id,int cls) {IntPtr p;int bytes;if(!WTSQuerySessionInformation(IntPtr.Zero,id,cls,out p,out bytes))return null;try{return Marshal.PtrToStringUni(p);} finally{WTSFreeMemory(p);}}
 public static Row[] Read() {
  IntPtr p;int count;if(!WTSEnumerateSessions(IntPtr.Zero,0,1,out p,out count))throw new Exception("WTS enumeration failed");
  var rows=new List<Row>();try {
   int size=Marshal.SizeOf(typeof(SI));
   for(int i=0;i<count;i++) {var si=(SI)Marshal.PtrToStructure(IntPtr.Add(p,i*size),typeof(SI));
    string user=Text(si.Id,5); if(String.IsNullOrEmpty(user))continue;
    var row=new Row{id=si.Id,user=user,domain=Text(si.Id,7),state=si.State==0?"ACTIVE":si.State==4?"DISCONNECTED":"OTHER",clientName=Text(si.Id,10)};
    IntPtr ip;int bytes;
    if(WTSQuerySessionInformation(IntPtr.Zero,si.Id,24,out ip,out bytes))try {
     if(bytes>=Marshal.SizeOf(typeof(INFO))) {var info=(INFO)Marshal.PtrToStructure(ip,typeof(INFO));row.logonAt=Stamp(info.LogonTime);
      if(si.State==4 && info.DisconnectTime>0 && info.CurrentTime>=info.DisconnectTime){row.disconnectedAt=Stamp(info.DisconnectTime);row.disconnectedSeconds=(info.CurrentTime-info.DisconnectTime)/10000000;}
     }
    }finally{WTSFreeMemory(ip);}
    if(WTSQuerySessionInformation(IntPtr.Zero,si.Id,14,out ip,out bytes))try {
     if(bytes>=24 && Marshal.ReadInt32(ip)==2)row.clientAddress=String.Format("{0}.{1}.{2}.{3}",Marshal.ReadByte(ip,6),Marshal.ReadByte(ip,7),Marshal.ReadByte(ip,8),Marshal.ReadByte(ip,9));
    }finally{WTSFreeMemory(ip);}
    rows.Add(row);
   }
  }finally{WTSFreeMemory(p);}return rows.ToArray();
 }
}
'@
Add-Type -AssemblyName System.DirectoryServices.AccountManagement
$adminGroup = Get-WmiObject Win32_Group -Filter "LocalAccount=True AND SID='S-1-5-32-544'"
$adminSids = @()
$adminResolutionOk = $false
try {
 $ag = [ADSI]("WinNT://"+$env:COMPUTERNAME+"/"+$adminGroup.Name+",group")
 $adminSids = @($ag.psbase.Invoke('Members') | ForEach-Object {
  $bytes = $_.GetType().InvokeMember('ObjectSID','GetProperty',$null,$_,$null)
  (New-Object System.Security.Principal.SecurityIdentifier($bytes,0)).Value
 })
 $adminResolutionOk = $true
} catch { }
function Get-AdminStatus($domain,$user) {
 if(-not $adminResolutionOk){return @{isAdmin=$null;adminEvidence='Grupo Administradores não pôde ser consultado'}}
 try {
  $account=New-Object System.Security.Principal.NTAccount($domain,$user)
  $sid=$account.Translate([System.Security.Principal.SecurityIdentifier]).Value
  if($adminSids -contains $sid){return @{isAdmin=$true;adminEvidence='Membro direto do grupo local Administradores (SID)'}}
  $sids=@($sid)
  if($domain -eq $env:COMPUTERNAME){
   $u=[ADSI]("WinNT://"+$domain+"/"+$user+",user")
   $sids += @($u.psbase.Invoke('Groups') | ForEach-Object {
    $bytes=$_.GetType().InvokeMember('ObjectSID','GetProperty',$null,$_,$null)
    (New-Object System.Security.Principal.SecurityIdentifier($bytes,0)).Value
   })
  } else {
   $ctx=New-Object System.DirectoryServices.AccountManagement.PrincipalContext([System.DirectoryServices.AccountManagement.ContextType]::Domain,$domain)
   $u=[System.DirectoryServices.AccountManagement.UserPrincipal]::FindByIdentity($ctx,$user)
   if($null -eq $u){throw 'Account lookup failed'}
   try{$sids+=@($u.GetAuthorizationGroups()|ForEach-Object {$_.Sid.Value})}finally{$u.Dispose();$ctx.Dispose()}
  }
  $matching=@($sids|Where-Object {$adminSids -contains $_})
  return @{isAdmin=($matching.Count -gt 0);adminEvidence='Associação de grupos consultada; grupos de domínio resolvidos por autorização quando aplicável'}
 } catch {return @{isAdmin=$null;adminEvidence='Associação administrativa não pôde ser confirmada'}}
}
$sessions=@([NexusTsRead]::Read() | ForEach-Object {
 $r=$_;$a=Get-AdminStatus $r.domain $r.user
 $userPolicyMs=$null
 try {
  $account=New-Object System.Security.Principal.NTAccount($r.domain,$r.user)
  $sid=$account.Translate([System.Security.Principal.SecurityIdentifier]).Value
  $up=Get-ItemProperty ("Registry::HKEY_USERS\"+$sid+'\Software\Policies\Microsoft\Windows NT\Terminal Services') -ErrorAction SilentlyContinue
  $userPolicyMs=$up.MaxDisconnectionTime
 } catch { }
 [ordered]@{userMaxDisconnectionTimeMs=$userPolicyMs;id=$r.id;user=$r.user;domain=$r.domain;state=$r.state;logonAt=$r.logonAt;disconnectedAt=$r.disconnectedAt;disconnectedSeconds=$r.disconnectedSeconds;clientName=$r.clientName;clientAddress=$r.clientAddress;isAdmin=$a.isAdmin;adminEvidence=$a.adminEvidence}
})
$events=@();$eventHealth='OK'
try {
 $events=@(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TerminalServices-LocalSessionManager/Operational';Id=21,23,24,25;StartTime=(Get-Date).AddHours(-24)} -MaxEvents 500 | ForEach-Object {
  $e=$_;[xml]$xml=$e.ToXml();$data=@{};$node=$xml.Event.UserData.EventXML
  if($node){foreach($child in $node.ChildNodes){$data[$child.LocalName]=$child.InnerText}}
  [ordered]@{id=($env:COMPUTERNAME+':'+$e.RecordId);eventId=$e.Id;at=$e.TimeCreated.ToUniversalTime().ToString('o');user=$data['User'];sessionId=$data['SessionID'];type=(@{21='LOGON';23='LOGOFF';24='DISCONNECT';25='RECONNECT'}[$e.Id]);source='TerminalServices-LocalSessionManager/Operational'}
 })
} catch {$eventHealth='UNAVAILABLE'}
$machinePolicy=Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services' -ErrorAction SilentlyContinue
$listenerPolicy=Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -ErrorAction SilentlyContinue
[ordered]@{server=$env:COMPUTERNAME;ip='192.168.2.100';collectedAt=[DateTime]::UtcNow.ToString('o');sessions=$sessions;events=$events;eventHealth=$eventHealth;policy=[ordered]@{disconnectLimitMinutes=30;toleranceSeconds=120;mode='OBSERVE_ONLY';effectivePolicy=@{machineMaxDisconnectionTimeMs=$machinePolicy.MaxDisconnectionTime;machineResetBroken=$machinePolicy.fResetBroken;listenerMaxDisconnectionTimeMs=$listenerPolicy.MaxDisconnectionTime;note='Valores de máquina observados; política efetiva por usuário e exceções precisam de validação RSOP'}}} | ConvertTo-Json -Depth 8 -Compress
