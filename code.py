import board
import digitalio
import neopixel
import time
import random
import math
import rotaryio

# === HARDWARE-KONFIG ===
PIX_PIN     = board.IO16

ENC_CLK_PIN = board.IO17
ENC_DT_PIN  = board.IO18
ENC_SW_PIN  = board.IO21

PIX_CNT     = 64
PIX_BRT     = 0.15 # Reduced brightness for better visibility

led = neopixel.NeoPixel(PIX_PIN, PIX_CNT, brightness=PIX_BRT, auto_write=False)

# Rotary Encoder using rotaryio for better reliability
encoder = rotaryio.IncrementalEncoder(ENC_CLK_PIN, ENC_DT_PIN)

# Button with pull up
sw_pin = digitalio.DigitalInOut(ENC_SW_PIN)
sw_pin.switch_to_input(pull=digitalio.Pull.UP)

# === PALETTE ===
BASE_PALETTE = [
    (255, 0, 0),     # Red
    (0, 255, 0),     # Green
    (0, 0, 255),     # Blue
    (255, 255, 0),   # Yellow
    (255, 0, 255),   # Magenta
    (0, 255, 255),   # Cyan
    (255, 128, 0),   # Orange
    (128, 0, 255),   # Purple
]

# === STATE ===
target_color = (0, 0, 0)
player_color = [0, 0, 0] # Using list for easy modification
player_coarse_idx = 0

# fine_channel: 0=R, 1=G, 2=B
fine_channel = 0

game_state = "IDLE"
memory_start = 0
memory_time = 3.0 # Show target for 3 seconds

rating = 0
last_position = 0

# === HELPERS ===

def clamp(v):
    return max(0, min(255, int(v)))

def clear():
    led.fill((0, 0, 0))

def set_px(x, y, color):
    # Standard 8x8 matrix layout (y*8 + x)
    if 0 <= x < 8 and 0 <= y < 8:
        led[y * 8 + x] = color

def draw_rect(x1, y1, x2, y2, color):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            set_px(x, y, color)

def color_distance(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def calculate_rating(dist):
    # Max possible distance is sqrt(255^2 * 3) approx 441.6
    max_dist = 442.0
    score = max(1, min(8, int(8 * (1 - (dist / max_dist)))))
    return score

# === INPUT ===

last_btn = True
last_btn_time = 0

def get_encoder_delta():
    global last_position
    current_position = encoder.position
    delta = current_position - last_position
    last_position = current_position
    return delta

def button_pressed():
    global last_btn, last_btn_time
    now = time.monotonic()
    v = sw_pin.value
    pressed = False

    if last_btn and not v: # Transition High -> Low (Pressed)
        if now - last_btn_time > 0.2: # Debounce
            last_btn_time = now
            pressed = True

    last_btn = v
    return pressed

# === LOOP ===

while True:
    delta = get_encoder_delta()
    btn = button_pressed()

    clear()
    now = time.monotonic()

    # ---------------- IDLE ----------------
    if game_state == "IDLE":
        # Draw a slow breathing effect on some pixels
        brightness = (math.sin(now * 3) + 1) / 2 * 30 + 5
        for x in range(2, 6):
            for y in range(2, 6):
                set_px(x, y, (int(brightness), int(brightness), int(brightness)))

        if btn:
            target_color = random.choice(BASE_PALETTE)
            game_state = "MEMORY"
            memory_start = now

    # ---------------- MEMORY ----------------
    elif game_state == "MEMORY":
        elapsed = now - memory_start
        if elapsed >= memory_time:
            game_state = "COARSE"
            player_coarse_idx = 0
            continue

        # Flash target color
        draw_rect(0, 0, 7, 7, target_color)

    # ---------------- COARSE SELECTION ----------------
    elif game_state == "COARSE":
        if delta:
            player_coarse_idx = (player_coarse_idx + delta) % len(BASE_PALETTE)
        
        candidate = BASE_PALETTE[player_coarse_idx]
        
        # Show palette dots on row 0
        for i in range(len(BASE_PALETTE)):
            dot_color = BASE_PALETTE[i]
            if i == player_coarse_idx:
                # Highlight selected
                s = (math.sin(now * 10) + 1) / 2
                dot_color = tuple(int(c * (0.5 + 0.5 * s)) for c in dot_color)
            set_px(i, 0, dot_color)

        # Bottom part: Candidate color
        draw_rect(0, 2, 7, 7, candidate)

        if btn:
            player_color = list(candidate)
            game_state = "FINE"
            fine_channel = 0 

    # ---------------- FINE TUNING ----------------
    elif game_state == "FINE":
        if delta:
            player_color[fine_channel] = clamp(player_color[fine_channel] + delta * 4)

        # Row 0: Progress dots for channels
        for i in range(3):
            c = [(255, 0, 0), (0, 255, 0), (0, 0, 255)][i]
            if i == fine_channel:
                # Blink current
                if int(now * 5) % 2 == 0: c = (255, 255, 255)
            set_px(i + 2, 0, c)
        
        # Row 1: Bar for current channel value
        val_width = int((player_color[fine_channel] / 255) * 8)
        for x in range(val_width):
            set_px(x, 1, [(100,0,0), (0,100,0), (0,0,100)][fine_channel])

        # Bottom part: Current custom color
        draw_rect(0, 3, 7, 7, tuple(player_color))

        if btn:
            fine_channel += 1
            if fine_channel > 2:
                dist = color_distance(target_color, player_color)
                rating = calculate_rating(dist)
                game_state = "RATING"

    # ---------------- RATING ----------------
    elif game_state == "RATING":
        # Split screen: Target vs Result
        # Left half target, Right half player
        for x in range(4):
            for y in range(4):
                set_px(x, y, target_color)
                set_px(x + 4, y, tuple(player_color))
        
        # Rating bar at bottom
        for i in range(8):
            c = (20, 20, 0) # Dim yellow
            if i < rating:
                c = (255, 255, 0) # Bright yellow
            set_px(i, 6, c)
            set_px(i, 7, c)

        if btn:
            game_state = "IDLE"

    led.show()
    time.sleep(0.01)
