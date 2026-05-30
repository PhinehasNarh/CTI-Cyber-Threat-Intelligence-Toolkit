"""MITRE ATT&CK auto-mapper — keyword matching against technique descriptions."""

# Technique definitions: id → {name, tactic, tactic_id, keywords}
ATTACK_MAP: dict[str, dict] = {
    # Reconnaissance
    "T1595": {"name": "Active Scanning", "tactic": "Reconnaissance", "tactic_id": "TA0043",
               "keywords": ["port scan", "network scan", "active scanning", "vulnerability scan", "nmap"]},
    "T1589": {"name": "Gather Victim Identity Information", "tactic": "Reconnaissance", "tactic_id": "TA0043",
               "keywords": ["credential harvesting", "email harvesting", "osint", "open source intelligence"]},
    # Resource Development
    "T1583": {"name": "Acquire Infrastructure", "tactic": "Resource Development", "tactic_id": "TA0042",
               "keywords": ["bulletproof hosting", "dedicated server", "domain registration", "infrastructure acquisition"]},
    "T1588": {"name": "Obtain Capabilities", "tactic": "Resource Development", "tactic_id": "TA0042",
               "keywords": ["exploit kit", "crimeware", "malware-as-a-service", "maas", "dark web purchase"]},
    # Initial Access
    "T1566": {"name": "Phishing", "tactic": "Initial Access", "tactic_id": "TA0001",
               "keywords": ["phishing", "spearphishing", "spear phishing", "phish", "malicious email", "email lure",
                             "malicious attachment", "bec", "business email compromise"]},
    "T1190": {"name": "Exploit Public-Facing Application", "tactic": "Initial Access", "tactic_id": "TA0001",
               "keywords": ["web application exploit", "rce", "remote code execution", "sql injection",
                             "path traversal", "log4j", "log4shell", "zero-day", "0-day"]},
    "T1133": {"name": "External Remote Services", "tactic": "Initial Access", "tactic_id": "TA0001",
               "keywords": ["vpn exploit", "rdp exploit", "remote desktop", "citrix exploit",
                             "pulse secure", "fortinet exploit"]},
    "T1189": {"name": "Drive-by Compromise", "tactic": "Initial Access", "tactic_id": "TA0001",
               "keywords": ["drive-by", "drive by download", "malvertising", "watering hole", "browser exploit"]},
    "T1195": {"name": "Supply Chain Compromise", "tactic": "Initial Access", "tactic_id": "TA0001",
               "keywords": ["supply chain", "dependency confusion", "typosquatting", "malicious package",
                             "npm package", "pypi package", "solarwinds"]},
    "T1078": {"name": "Valid Accounts", "tactic": "Initial Access", "tactic_id": "TA0001",
               "keywords": ["stolen credentials", "credential stuffing", "valid credentials",
                             "compromised account", "account takeover"]},
    # Execution
    "T1059": {"name": "Command and Scripting Interpreter", "tactic": "Execution", "tactic_id": "TA0002",
               "keywords": ["powershell", "cmd.exe", "bash script", "shell script", "vbscript",
                             "wscript", "cscript", "python script", "macro"]},
    "T1204": {"name": "User Execution", "tactic": "Execution", "tactic_id": "TA0002",
               "keywords": ["malicious link", "malicious document", "lure document", "opened attachment"]},
    "T1053": {"name": "Scheduled Task/Job", "tactic": "Execution", "tactic_id": "TA0002",
               "keywords": ["scheduled task", "cron job", "crontab", "task scheduler"]},
    # Persistence
    "T1547": {"name": "Boot or Logon Autostart", "tactic": "Persistence", "tactic_id": "TA0003",
               "keywords": ["registry run key", "startup folder", "autorun", "autostart", "boot persistence"]},
    "T1505": {"name": "Server Software Component", "tactic": "Persistence", "tactic_id": "TA0003",
               "keywords": ["webshell", "web shell", "php webshell", "aspx shell"]},
    "T1136": {"name": "Create Account", "tactic": "Persistence", "tactic_id": "TA0003",
               "keywords": ["backdoor account", "rogue account", "created user", "ghost account"]},
    "T1176": {"name": "Browser Extensions", "tactic": "Persistence", "tactic_id": "TA0003",
               "keywords": ["malicious extension", "browser extension", "chrome extension", "browser addon"]},
    # Privilege Escalation
    "T1068": {"name": "Exploitation for Privilege Escalation", "tactic": "Privilege Escalation", "tactic_id": "TA0004",
               "keywords": ["privilege escalation", "local privilege", "lpe", "kernel exploit",
                             "elevation of privilege", "privesc"]},
    "T1548": {"name": "Abuse Elevation Control Mechanism", "tactic": "Privilege Escalation", "tactic_id": "TA0004",
               "keywords": ["uac bypass", "sudo abuse", "setuid", "user account control bypass"]},
    # Defense Evasion
    "T1027": {"name": "Obfuscated Files or Information", "tactic": "Defense Evasion", "tactic_id": "TA0005",
               "keywords": ["obfuscation", "obfuscated", "encoded payload", "base64 encoded",
                             "packed malware", "packer", "encrypted payload"]},
    "T1055": {"name": "Process Injection", "tactic": "Defense Evasion", "tactic_id": "TA0005",
               "keywords": ["process injection", "dll injection", "shellcode injection",
                             "process hollowing", "reflective loading", "code injection"]},
    "T1562": {"name": "Impair Defenses", "tactic": "Defense Evasion", "tactic_id": "TA0005",
               "keywords": ["disable antivirus", "disable defender", "kill antivirus", "disable logging",
                             "edr bypass", "av bypass", "amsi bypass", "tamper protection"]},
    "T1070": {"name": "Indicator Removal", "tactic": "Defense Evasion", "tactic_id": "TA0005",
               "keywords": ["log deletion", "clear logs", "event log cleared", "artifact removal",
                             "timestomp", "file deletion"]},
    "T1036": {"name": "Masquerading", "tactic": "Defense Evasion", "tactic_id": "TA0005",
               "keywords": ["masquerading", "renamed executable", "living off the land",
                             "lolbins", "lolbas", "signed binary proxy"]},
    # Credential Access
    "T1003": {"name": "OS Credential Dumping", "tactic": "Credential Access", "tactic_id": "TA0006",
               "keywords": ["credential dumping", "mimikatz", "lsass", "ntds.dit", "sam database",
                             "hashdump", "pass the hash", "pass-the-hash"]},
    "T1110": {"name": "Brute Force", "tactic": "Credential Access", "tactic_id": "TA0006",
               "keywords": ["brute force", "brute-force", "password spray", "password spraying",
                             "credential brute"]},
    "T1056": {"name": "Input Capture", "tactic": "Credential Access", "tactic_id": "TA0006",
               "keywords": ["keylogger", "keylogging", "keystroke", "form grabbing"]},
    "T1539": {"name": "Steal Web Session Cookie", "tactic": "Credential Access", "tactic_id": "TA0006",
               "keywords": ["cookie theft", "session hijacking", "cookie stealer", "infostealer cookie"]},
    "T1557": {"name": "Adversary-in-the-Middle", "tactic": "Credential Access", "tactic_id": "TA0006",
               "keywords": ["man in the middle", "mitm", "aitm", "adversary in the middle",
                             "arp poisoning", "ssl stripping"]},
    # Discovery
    "T1046": {"name": "Network Service Discovery", "tactic": "Discovery", "tactic_id": "TA0007",
               "keywords": ["network service scan", "service enumeration", "port discovery"]},
    "T1087": {"name": "Account Discovery", "tactic": "Discovery", "tactic_id": "TA0007",
               "keywords": ["account enumeration", "user enumeration", "ldap enumeration",
                             "active directory enumeration", "net user"]},
    # Lateral Movement
    "T1021": {"name": "Remote Services", "tactic": "Lateral Movement", "tactic_id": "TA0008",
               "keywords": ["lateral movement", "smb lateral", "wmi lateral", "psexec lateral",
                             "ssh lateral", "winrm"]},
    "T1550": {"name": "Use Alternate Authentication Material", "tactic": "Lateral Movement", "tactic_id": "TA0008",
               "keywords": ["pass the ticket", "golden ticket", "silver ticket", "kerberoasting",
                             "overpass the hash"]},
    # Collection
    "T1114": {"name": "Email Collection", "tactic": "Collection", "tactic_id": "TA0009",
               "keywords": ["email theft", "mailbox access", "owa access", "email exfiltration", "exchange theft"]},
    "T1113": {"name": "Screen Capture", "tactic": "Collection", "tactic_id": "TA0009",
               "keywords": ["screenshot", "screen capture", "desktop capture"]},
    # Command and Control
    "T1071": {"name": "Application Layer Protocol", "tactic": "Command and Control", "tactic_id": "TA0011",
               "keywords": ["c2", "c&c", "command and control", "command-and-control", "beacon",
                             "cobalt strike", "cobaltstrike", "http c2", "dns c2", "dns tunnel"]},
    "T1090": {"name": "Proxy", "tactic": "Command and Control", "tactic_id": "TA0011",
               "keywords": ["proxy c2", "tor c2", "domain fronting", "traffic proxy", "socks proxy"]},
    "T1219": {"name": "Remote Access Software", "tactic": "Command and Control", "tactic_id": "TA0011",
               "keywords": ["remote access trojan", "rat", "anydesk abuse", "teamviewer abuse",
                             "njrat", "asyncrat", "quasar rat", "remcos"]},
    "T1572": {"name": "Protocol Tunneling", "tactic": "Command and Control", "tactic_id": "TA0011",
               "keywords": ["dns tunneling", "icmp tunneling", "protocol tunnel", "covert channel"]},
    # Exfiltration
    "T1041": {"name": "Exfiltration Over C2 Channel", "tactic": "Exfiltration", "tactic_id": "TA0010",
               "keywords": ["data exfiltration", "exfiltrated", "data theft", "stolen data", "exfil"]},
    "T1567": {"name": "Exfiltration Over Web Service", "tactic": "Exfiltration", "tactic_id": "TA0010",
               "keywords": ["exfiltration dropbox", "exfiltration mega", "mega.nz exfil",
                             "exfiltration cloud storage", "file upload exfil"]},
    # Impact
    "T1486": {"name": "Data Encrypted for Impact", "tactic": "Impact", "tactic_id": "TA0040",
               "keywords": ["ransomware", "encrypted files", "ransom demand", "ransom note",
                             "file encryption", "lockbit", "blackcat", "alphv", "cl0p",
                             "revil", "hive ransomware", "conti", "akira", "play ransomware"]},
    "T1490": {"name": "Inhibit System Recovery", "tactic": "Impact", "tactic_id": "TA0040",
               "keywords": ["shadow copies deleted", "vssadmin delete", "backup deletion",
                             "recovery prevention", "bcdedit", "wbadmin delete"]},
    "T1485": {"name": "Data Destruction", "tactic": "Impact", "tactic_id": "TA0040",
               "keywords": ["data destruction", "wiper", "wiperware", "data wiped", "disk wiper",
                             "notpetya", "hermetic wiper", "whispergate"]},
    "T1498": {"name": "Network Denial of Service", "tactic": "Impact", "tactic_id": "TA0040",
               "keywords": ["ddos", "denial of service", "dos attack", "distributed denial", "bandwidth flood"]},
    "T1496": {"name": "Resource Hijacking", "tactic": "Impact", "tactic_id": "TA0040",
               "keywords": ["cryptomining", "cryptojacking", "coin miner", "xmrig", "monero mining", "cpu mining"]},
}

# Ordered tactic list for display
TACTIC_ORDER = [
    ("TA0043", "Reconnaissance"),
    ("TA0042", "Resource Development"),
    ("TA0001", "Initial Access"),
    ("TA0002", "Execution"),
    ("TA0003", "Persistence"),
    ("TA0004", "Privilege Escalation"),
    ("TA0005", "Defense Evasion"),
    ("TA0006", "Credential Access"),
    ("TA0007", "Discovery"),
    ("TA0008", "Lateral Movement"),
    ("TA0009", "Collection"),
    ("TA0011", "Command and Control"),
    ("TA0010", "Exfiltration"),
    ("TA0040", "Impact"),
]


def map_to_attack(text: str) -> list[str]:
    """Return a list of matched ATT&CK technique IDs (capped at 10)."""
    if not text:
        return []
    text_lower = text.lower()
    matched: list[str] = []
    for technique_id, data in ATTACK_MAP.items():
        for keyword in data["keywords"]:
            if keyword in text_lower:
                matched.append(technique_id)
                break
    return matched[:10]
