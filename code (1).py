import board
import digitalio
import neopixel
import time
import random
import math
import rotaryio

# ================= HARDWARE =================
PIX_PIN = board.IO16
ENC_CLK_PIN = board.IO17
ENC_DT_PIN = board.IO18
ENC_SW_PIN = board.IO21

PIX_CNT = 64
PIX_BRT = 0.15

led = neopixel.NeoPixel(PIX_PIN, PIX_CNT, brightness=PIX_BRT, auto_write=False)

encoder = rotaryio.IncrementalEncoder(ENC_CLK_PIN, ENC_DT_PIN)

sw_pin = digitalio.DigitalInOut(ENC_SW_PIN)
sw_pin.switch_to_input(pull=digitalio.Pull.UP)

# ================= COLOR ENGINE =================
def hsv_to_rgb(h, s, v):
    i = int(h * 6)
    f = (h * 6) - i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    i %= 6

    if i == 0: r, g, b = v, t, p
    elif i == 1: r, g, b = q, v, p
    elif i == 2: r, g, b = p, v, t
    elif i == 3: r, g, b = p, q, v
    elif i == 4: r, g, b = t, p, v
    else: r, g, b = v, p, q

    return (int(r * 255), int(g * 255), int(b * 255))

# ================= 1024 COLOR PALETTE =================
PALETTE = [hsv_to_rgb(i / 1024.0, 1.0, 1.0) for i in range(1024)]

def get_random_target():
    return random.choice(PALETTE)

# ================= HELPERS =================
def clear():
    led.fill((0, 0, 0))

def set_px(x, y, color):
    if 0 <= x < 8 and 0 <= y < 8:
        led[y * 8 + x] = color

def draw_rect(x1, y1, x2, y2, color):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            set_px(x, y, color)

def color_distance(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def calculate_rating(dist):
    max_dist = 441.6
    return max(1, min(8, round(8 * (1 - dist / max_dist))))

def rating_color(i, rating):
    if i < rating:
        t = i / 7
        return (int(255 * (1 - t)), int(255 * t), 0)
    return (10, 10, 10)

# ================= ANIMATIONS =================
def boot_animation():
    for i in range(64):
        led[i] = PALETTE[i * 8 % 1024]
        led.show()
        time.sleep(0.01)
    clear()
    led.show()

def perfect_animation():
    for _ in range(3):
        led.fill((255, 255, 255))
        led.show()
        time.sleep(0.1)
        clear()
        led.show()
        time.sleep(0.1)

    for j in range(25):
        for i in range(64):
            led[i] = PALETTE[(i * 10 + j) % 1024]
        led.show()
        time.sleep(0.03)

def standby_wave(t):
    cx, cy = 3.5, 3.5
    speed = 3.0

    for x in range(8):
        for y in range(8):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx*dx + dy*dy)

            pulse = math.sin(dist - t * speed)
            v = max(0, pulse) * max(0, 1 - dist / 5)

            color = PALETTE[int((dist * 30 + t * 80) % 1024)]
            set_px(x, y, hsv_to_rgb((color[0] / 255), 1, v))

# ================= STATE =================
hue = 0.0
player_color = (0, 0, 0)
target_color = (0, 0, 0)

game_state = "IDLE"
memory_start = 0
memory_time = 2.5

rating = 0
last_position = 0

last_input_time = time.monotonic()
standby_stage = 0
standby_start = 0

# ================= INPUT =================
last_btn = True
last_btn_time = 0

def get_encoder_delta():
    global last_position
    p = encoder.position
    d = p - last_position
    last_position = p
    return d

def button_pressed():
    global last_btn, last_btn_time
    now = time.monotonic()
    v = sw_pin.value

    pressed = False
    if last_btn and not v:
        if now - last_btn_time > 0.2:
            last_btn_time = now
            pressed = True

    last_btn = v
    return pressed

# ================= START =================
boot_animation()

# ================= LOOP =================
while True:
    delta = get_encoder_delta()
    btn = button_pressed()
    now = time.monotonic()

    if delta or btn:
        last_input_time = now
        standby_stage = 0

    # ================= STANDBY =================
    if now - last_input_time > 60:

        if standby_stage == 0:
            standby_stage = 1
            standby_start = now

        if standby_stage == 1:
            t = now - standby_start
            standby_wave(t)

            if t > 4:
                clear()
                led.show()
                standby_stage = 2

        elif standby_stage == 2:
            pass

        led.show()
        time.sleep(0.03)
        continue

    clear()

    # ================= IDLE =================
    if game_state == "IDLE":
        glow = (math.sin(now * 3) + 1) / 2 * 40

        for x in range(8):
            for y in range(8):
                set_px(x, y, (int(glow), int(glow), int(glow)))

        if btn:
            target_color = get_random_target()
            memory_start = now
            game_state = "MEMORY"

    # ================= MEMORY =================
    elif game_state == "MEMORY":
        elapsed = now - memory_start

        draw_rect(0, 0, 7, 7, target_color)

        bar = int((1 - elapsed / memory_time) * 8)
        for x in range(bar):
            set_px(x, 7, (255, 255, 255))

        if elapsed >= memory_time:
            hue = 0.0
            game_state = "COARSE"

    # ================= COARSE =================
    elif game_state == "COARSE":

        if delta:
            hue = (hue + delta * 0.005) % 1.0

        candidate = hsv_to_rgb(hue, 1.0, 1.0)

        for x in range(8):
            h = (hue + (x - 4) * 0.02) % 1.0
            set_px(x, 0, hsv_to_rgb(h, 1.0, 1.0))

        set_px(4, 0, (255, 255, 255))
        draw_rect(0, 2, 7, 7, candidate)

        if btn:
            player_color = candidate
            dist = color_distance(player_color, target_color)
            rating = calculate_rating(dist)

            if rating == 8:
                perfect_animation()

            game_state = "RATING"

    # ================= RATING =================
    elif game_state == "RATING":

        for x in range(4):
            for y in range(4):
                set_px(x, y, target_color)
                set_px(x + 4, y, player_color)

        for i in range(8):
            set_px(i, 6, rating_color(i, rating))
            set_px(i, 7, rating_color(i, rating))

        if btn:
            game_state = "IDLE"

    led.show()
    time.sleep(0.01)8
