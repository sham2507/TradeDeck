import requests

def is_service_3000_healthy():
    try:
        response = requests.get("http://localhost:3000/health", timeout=3)
        if response.status_code == 200:
            data = response.json()
            return data.get("msg") == "running"
    except requests.RequestException:
        pass
    return False


def is_service_3001_healthy():
    try:
        response = requests.get("http://localhost:3001/health", timeout=3)
        if response.status_code == 200:
            data = response.json()
            return data.get("redisConnected") == True and data.get("brokerWSConnected") == True
    except requests.RequestException:
        pass
    return False
