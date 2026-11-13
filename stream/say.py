# Post one line in the stream's chat (cx247vods) as the channel, with vodloop's kickapi and the channel's token on
# Oracle. Called by the engine (CHAT_SSH): python3 ~/szdash/say.py <base64 text>
import base64, os, sys

os.environ.setdefault("CHAN_ROOT", "/home/ubuntu/v2/cx247vods")
sys.path.insert(0, "/home/ubuntu/v2/bin")
import chan, kickapi  # noqa: E402

text = base64.b64decode(sys.argv[1]).decode()[:480]
print(kickapi.say(int(chan.conf_num("KICK_USER_ID", 0)), text))
