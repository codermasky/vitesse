from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize the limiter with the remote address key function
# This identifies clients by their IP address
limiter = Limiter(key_func=get_remote_address)
