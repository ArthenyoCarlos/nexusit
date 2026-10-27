"""NTLM encrypted WinRM, cofre decrypted only in memory. No secrets in argv or logs."""
import base64,json,subprocess
import winrm
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def session():
    sql="SELECT row_to_json(x) FROM (SELECT username,secret FROM vault_credentials WHERE id='7b351284-3c64-45a5-9f3e-dd6c5ced1839' AND lower(trim(title))='ts') x"
    record=json.loads(subprocess.check_output(['docker','exec','nexusit-db','psql','-U','nexusit','-d','nexusit','-Atc',sql],text=True,timeout=10))
    key=subprocess.check_output(['docker','exec','nexusit-backend','printenv','VAULT_ENCRYPTION_KEY'],timeout=10).rstrip(b'\n')[:32].ljust(32,b'\0')
    raw=base64.b64decode(record['secret']);password=AESGCM(key).decrypt(raw[:12],raw[12:],None).decode()
    return winrm.Session('http://192.168.2.100:5985/wsman',auth=(record['username'],password),transport='ntlm',message_encryption='always',operation_timeout_sec=45,read_timeout_sec=55)
