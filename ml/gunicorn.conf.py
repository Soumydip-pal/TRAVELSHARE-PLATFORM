"""
Gunicorn configuration for TravelShare ML API
Usage: gunicorn -c ml/gunicorn.conf.py api.app:app
"""
import multiprocessing
import os

# Server socket
bind        = f"0.0.0.0:{os.environ.get('PORT', '5001')}"
backlog     = 64

# Workers
workers     = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 100
timeout     = 30
keepalive   = 2

# Logging
accesslog   = "-"      # stdout
errorlog    = "-"      # stderr
loglevel    = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" %(D)s'

# Process naming
proc_name   = "travelshare-ml"

# Lifecycle hooks
def on_starting(server):
    server.log.info("TravelShare ML API starting")

def on_exit(server):
    server.log.info("TravelShare ML API shutting down")
