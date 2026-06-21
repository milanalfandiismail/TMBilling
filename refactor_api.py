import os

routes_dir = r"c:\Milan\GIT\TMBilling\app\routes"
app_init = r"c:\Milan\GIT\TMBilling\app\__init__.py"

blueprint_map = {
    "auth_kasir_bp": "auth_kasir_api_bp",
    "auth_bp": "auth_api_bp",
    "backup_bp": "backup_api_bp",
    "blackout_bp": "blackout_api_bp",
    "client_bp": "client_api_bp",
    "grup_bp": "grup_api_bp",
    "member_portal_bp": "member_portal_api_bp",
    "member_bp": "member_api_bp",
    "menu_bp": "menu_api_bp",
    "monitor_bp": "monitor_api_bp",
    "paket_bp": "paket_api_bp",
    "pc_bp": "pc_api_bp",
    "report_bp": "report_api_bp",
    "sesi_bp": "sesi_api_bp",
    "shift_bp": "shift_api_bp",
    "tournament_bp": "tournament_api_bp",
    "user_bp": "user_api_bp",
    "settings_bp": "settings_api_bp",
    "plugin_bp": "plugin_api_bp",
    "migration_bp": "migration_api_bp"
}

def replace_in_file(filepath):
    if not os.path.isfile(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in blueprint_map.items():
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# Walk through routes directory
for root, dirs, files in os.walk(routes_dir):
    for file in files:
        if file.endswith('.py'):
            replace_in_file(os.path.join(root, file))

# Update app/__init__.py
replace_in_file(app_init)
print("Done!")
