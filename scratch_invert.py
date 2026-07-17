from PIL import Image
import numpy as np
import os

icon_path = r"C:\Milan\GIT\TMBilling\WarnetClient\TMBillingTauri\src-tauri\icons\icon.png"
if not os.path.exists(icon_path):
    print("icon.png not found")
    exit(1)

img = Image.open(icon_path).convert("RGBA")
data = np.array(img)

a = data[:, :, 3]
alpha_mask = a > 0

data[alpha_mask, 0] = 255 - data[alpha_mask, 0]
data[alpha_mask, 1] = 255 - data[alpha_mask, 1]
data[alpha_mask, 2] = 255 - data[alpha_mask, 2]

img_out = Image.fromarray(data)
img_out.save(r"C:\Milan\GIT\TMBilling\WarnetClient\TMBillingTauri\app-icon.png")
print("Image inverted and saved to app-icon.png!")
