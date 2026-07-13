import os
import json
import time
import logging

class ServerMonitorService:
    _lhm_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tmp", "lhm_metrics.json"))
    
    @classmethod
    def get_metrics(cls):
        metrics = {}
        
        # Parse from LHM JSON
        if os.path.exists(cls._lhm_path):
            try:
                # Cek umur file JSON (timeout 5 detik)
                file_age = time.time() - os.path.getmtime(cls._lhm_path)
                if file_age <= 5:
                    with open(cls._lhm_path, 'r', encoding='utf-8') as f:
                        metrics = json.load(f)
            except Exception as e:
                logging.error(f"[ServerMonitor] Error parsing LHM JSON: {e}")
                
        # If LHM is not running or json is stale
        if not metrics:
            return {
                "error": "LHM Service Offline",
                "cpu": {"name": "LHM Offline (N/A)", "percent": 0, "cores": 0, "threads": 0, "freq_mhz": 0, "temp": "N/A"},
                "ram": {"percent": 0, "used": 0, "total": 0, "free": 0},
                "disk": [],
                "nic": [],
                "gpu": [{"name": "LHM Offline (N/A)", "load": 0, "mem_used_mb": 0, "mem_total_mb": 0, "temp_c": "N/A"}]
            }
            
        return metrics
