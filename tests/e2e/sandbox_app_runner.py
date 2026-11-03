# Auto-generated sandbox runner
import os
import sys
project_root = r"C:\Project GIT\TMBilling"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

db_path = r"C:\Project GIT\TMBilling\instance\warnet_e2e_sandbox.db"
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
os.environ["FLASK_ENV"] = "testing"
os.environ["TESTING"] = "1"

from app import create_app
app = create_app()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7016
    from waitress import serve
    serve(app, host="127.0.0.1", port=port, threads=6)
