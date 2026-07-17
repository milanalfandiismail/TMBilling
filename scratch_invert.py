from PIL import Image
import numpy as np

icon_path = r"C:\Milan\GIT\TMBilling\WarnetClient\TMBillingTauri\src-tauri\icons\icon.png"
img = Image.open(icon_path).convert("RGBA")
data = np.array(img)

# Invert RGB to make dark colors light, preserving alpha
a = data[:, :, 3]
alpha_mask = a > 0

data[alpha_mask, 0] = 255 - data[alpha_mask, 0]
data[alpha_mask, 1] = 255 - data[alpha_mask, 1]
data[alpha_mask, 2] = 255 - data[alpha_mask, 2]

img_out = Image.fromarray(data)
# Save as the new app-icon to process
img_out.save(r"C:\Milan\GIT\TMBilling\WarnetClient\TMBillingTauri\app-icon.png")
print("Image inverted and saved to app-icon.png!")
