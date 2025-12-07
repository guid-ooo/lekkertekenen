/* Network E-Paper Display Sketch
 * Converted from CircuitPython to Arduino
 * Fetches BMP images from server and displays on 7.5" e-paper display
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP.h>
#include "DEV_Config.h"
#include "EPD.h"
#include "GUI_Paint.h"

struct WiFiNetwork {
  const char* ssid;
  const char* password;
};

WiFiNetwork wifiNetworks[] = {
  {"Tommy", "N13uwsg13r1g!"},
  {"TheGooseIsLoose", "pcM*KMHjpLzimqo@Y49-"},
};

const int numNetworks = sizeof(wifiNetworks) / sizeof(wifiNetworks[0]);
int currentNetworkIndex = 0;

const char* host = "krabbelen.site";
const char* imagePath = "/drawing.bmp";

// Display configuration
// Use the 3-color display constants (Black/Red/White)
#define DISPLAY_WIDTH EPD_7IN5B_V2_WIDTH
#define DISPLAY_HEIGHT EPD_7IN5B_V2_HEIGHT
// Use same buffer calculation as demo for safety
#define IMAGE_SIZE (((EPD_7IN5B_V2_WIDTH % 8 == 0) ? (EPD_7IN5B_V2_WIDTH / 8) : (EPD_7IN5B_V2_WIDTH / 8 + 1)) * EPD_7IN5B_V2_HEIGHT)

// Global variables for 3-color display
UBYTE* blackBuffer = NULL;  // Buffer for black pixels
UBYTE* redBuffer = NULL;    // Buffer for red pixels
// Change detection using pixel counts (simple and memory efficient)
int prevBlackPixels = -1;
int prevWhitePixels = -1;
int prevRedPixels = -1;
int currentBlackPixels = 0;
int currentWhitePixels = 0;
int currentRedPixels = 0;
WiFiClient client;
HTTPClient http;
int errorCount = 0;
unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 60000; // 1 minute for testing (change back to 180000 for production)
bool isFirstDisplay = true;  // Track if this is the very first display

void setup() {
  Serial.begin(115200);
  Serial.println("Network EPD Display starting...");
  
  // Initialize 3-color e-paper display
  DEV_Module_Init();
  Serial.println("EPD Init and Clear...");
  EPD_7IN5B_V2_Init();
  EPD_7IN5B_V2_Clear();
  delay(2000);  // Increased delay for proper initialization
  
  // Allocate buffers for 3-color display (only 2 buffers now to save memory)
  blackBuffer = (UBYTE*)malloc(IMAGE_SIZE);
  if (blackBuffer == NULL) {
    Serial.println("Failed to allocate black buffer");
    while(1);
  }
  
  redBuffer = (UBYTE*)malloc(IMAGE_SIZE);
  if (redBuffer == NULL) {
    Serial.println("Failed to allocate red buffer");
    while(1);
  }
  
  // Initialize buffers
  memset(blackBuffer, 0xFF, IMAGE_SIZE);  // White background
  memset(redBuffer, 0xFF, IMAGE_SIZE);    // No red initially
  
  // Print memory usage
  Serial.printf("Buffer size: %d bytes each\n", IMAGE_SIZE);
  Serial.printf("Total allocated: %d bytes (2 buffers)\n", IMAGE_SIZE * 2);
  Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
  
  // Initialize Paint library with black buffer
  Paint_NewImage(blackBuffer, DISPLAY_WIDTH, DISPLAY_HEIGHT, 0, WHITE);
  Paint_SelectImage(blackBuffer);
  Paint_Clear(WHITE);
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("Setup complete");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check for errors
  if (errorCount > 20) {
    Serial.println(errorCount);
    Serial.println("Too many errors, shutting down display and restarting...");
    shutdownDisplay();
    ESP.restart();
  }
  
  // Check if it's time to refresh
  if (currentTime - lastRefresh >= REFRESH_INTERVAL || lastRefresh == 0) {
    Serial.println("Starting image fetch and display...");
    if (fetchAndDisplayImage()) {
      lastRefresh = currentTime;
      errorCount = 0;  // Reset error count on success
      Serial.println("Image fetch and display completed successfully");
    } else {
      errorCount++;
      Serial.printf("Image fetch failed, error count: %d\n", errorCount);
    }
  }
  
  delay(1000);  // Short delay to prevent busy loop
}

void connectToWiFi() {
  // Try each network in sequence
  for (int networkIndex = 0; networkIndex < numNetworks; networkIndex++) {
    Serial.printf("Attempting to connect to network %d: %s\n", networkIndex + 1, wifiNetworks[networkIndex].ssid);
    
    WiFi.begin(wifiNetworks[networkIndex].ssid, wifiNetworks[networkIndex].password);
    Serial.print("Connecting");
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {  // Reduced attempts per network
      delay(1000);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("");
      Serial.printf("WiFi connected to: %s\n", wifiNetworks[networkIndex].ssid);
      Serial.print("IP address: ");
      Serial.println(WiFi.localIP());
      currentNetworkIndex = networkIndex;  // Remember which network worked
      return;  // Successfully connected
    } else {
      Serial.printf("\nFailed to connect to %s\n", wifiNetworks[networkIndex].ssid);
      WiFi.disconnect();  // Clean disconnect before trying next network
      delay(1000);
    }
  }
  
  // If we get here, no networks worked
  Serial.println("All WiFi networks failed!");
  errorCount++;
}

bool fetchAndDisplayImage() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, attempting reconnection...");
    
    // First try to reconnect to the last working network
    if (currentNetworkIndex < numNetworks) {
      Serial.printf("Trying to reconnect to last working network: %s\n", wifiNetworks[currentNetworkIndex].ssid);
      WiFi.begin(wifiNetworks[currentNetworkIndex].ssid, wifiNetworks[currentNetworkIndex].password);
      
      int quickAttempts = 0;
      while (WiFi.status() != WL_CONNECTED && quickAttempts < 10) {
        delay(1000);
        Serial.print(".");
        quickAttempts++;
      }
    }
    
    // If that didn't work, try all networks
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\nQuick reconnect failed, trying all networks...");
      connectToWiFi();
    }
    
    if (WiFi.status() != WL_CONNECTED) {
      return false;
    }
  }
  
  String url = String("https://") + host + imagePath;
  Serial.println("Fetching: " + url);
  
  http.begin(url);
  http.setTimeout(30000);  // 30 second timeout
  http.setReuse(false);    // Don't reuse connections to avoid issues
  
  int httpCode = http.GET();
  Serial.printf("HTTP response code: %d\n", httpCode);
  
  if (httpCode == HTTP_CODE_OK) {
    WiFiClient* stream = http.getStreamPtr();
    if (processBMPStream(stream)) {
      // Check if image actually changed
      if (hasImageChanged()) {
        Serial.println("Image changed, updating display...");
        
        // Use full init on first display, fast init afterwards
        if (isFirstDisplay) {
          EPD_7IN5B_V2_Init();
          isFirstDisplay = false;
        } else {
          EPD_7IN5B_V2_Init_Fast();
        }
        
        EPD_7IN5B_V2_Display(blackBuffer, redBuffer);
        delay(2000);  // Wait for display to complete
        
        Serial.println("Display updated successfully");
      } else {
        Serial.println("Image unchanged, skipping display update to save e-paper wear");
      }
      
      // Save pixel counts for next comparison
      prevBlackPixels = currentBlackPixels;
      prevWhitePixels = currentWhitePixels;
      prevRedPixels = currentRedPixels;
      Serial.printf("Saved pixel counts - Black: %d, White: %d, Red: %d\n", 
                    prevBlackPixels, prevWhitePixels, prevRedPixels);
      
      http.end();
      return true;
    }
  } else {
    Serial.printf("HTTP request failed: %d\n", httpCode);
  }
  
  http.end();
  return false;
}

bool processBMPStream(WiFiClient* stream) {
  // BMP header structure
  uint8_t header[54];
  
  // Read BMP header
  if (stream->readBytes(header, 54) != 54) {
    Serial.println("Failed to read BMP header");
    return false;
  }
  
  // Verify BMP signature
  if (header[0] != 'B' || header[1] != 'M') {
    Serial.println("Not a valid BMP file");
    return false;
  }
  
  // Debug BMP header info
  uint32_t fileSize = *((uint32_t*)&header[2]);
  uint32_t dataOffset = *((uint32_t*)&header[10]);
  uint32_t width = *((uint32_t*)&header[18]);
  uint32_t height = *((uint32_t*)&header[22]);
  uint16_t bitsPerPixel = *((uint16_t*)&header[28]);
  
  Serial.printf("BMP Info: %dx%d, %d bits/pixel, data at offset %d\n", width, (int32_t)height, bitsPerPixel, dataOffset);
  
  // Handle negative height (bottom-up BMP)
  bool bottomUp = false;
  if ((int32_t)height < 0) {
    bottomUp = true;
    height = -height;  // Make positive
    Serial.println("BMP is bottom-up format");
  }
  
  // Skip palette (16 bytes for 4-color palette)
  uint8_t palette[16];
  if (stream->readBytes(palette, 16) != 16) {
    Serial.println("Failed to read BMP palette");
    return false;
  }
  
  // Process image data
  // The CircuitPython version processes 4 pixels per byte (2 bits per pixel)
  // We need to convert this to 1 bit per pixel for the e-paper display
  
  // Re-initialize the Paint library for both buffers
  Paint_SelectImage(blackBuffer);
  Paint_Clear(WHITE);
  Paint_SelectImage(redBuffer);
  Paint_Clear(WHITE);
  
  int bytesPerRow = DISPLAY_WIDTH / 4;  // 4 pixels per byte in source
  uint8_t rowBuffer[bytesPerRow];
  
  Serial.printf("Processing BMP: %dx%d, %d bytes per row\n", DISPLAY_WIDTH, DISPLAY_HEIGHT, bytesPerRow);
  // Reset pixel counters for this image
  currentBlackPixels = 0;
  currentWhitePixels = 0;
  currentRedPixels = 0;
  
  for (int row = 0; row < DISPLAY_HEIGHT; row++) {
    // Add small delay to prevent overwhelming the stream
    if (row % 100 == 0) {
      delay(1);  // Small delay every 100 rows
    }
    
    int bytesRead = stream->readBytes(rowBuffer, bytesPerRow);
    if (bytesRead != bytesPerRow) {
      Serial.printf("Failed to read row %d (got %d/%d bytes)\n", row, bytesRead, bytesPerRow);
      return false;
    }
    
    // Calculate actual y coordinate (handle bottom-up BMP)
    int y = bottomUp ? row : (DISPLAY_HEIGHT - 1 - row);
    
    // Convert 4 pixels per byte (2 bits each) to individual pixels
    for (int byteIndex = 0; byteIndex < bytesPerRow; byteIndex++) {
      uint8_t byte = rowBuffer[byteIndex];
      
      // Extract 4 pixels from this byte
      for (int pixelInByte = 0; pixelInByte < 4; pixelInByte++) {
        int x = byteIndex * 4 + pixelInByte;
        if (x >= DISPLAY_WIDTH) break;
        
        // Extract 2-bit pixel value
        uint8_t pixelValue = (byte >> (6 - pixelInByte * 2)) & 0x03;
        
        // Map 2-bit values to 3-color display:
        // 0 = white (background)
        // 1 = black  
        // 2 = red
        // 3 = black (or another shade)
        
        // Draw to black buffer
        Paint_SelectImage(blackBuffer);
        if (pixelValue == 1 || pixelValue == 3) {
          Paint_DrawPoint(x, y, BLACK, DOT_PIXEL_1X1, DOT_STYLE_DFT);
          currentBlackPixels++;
        } else {
          Paint_DrawPoint(x, y, WHITE, DOT_PIXEL_1X1, DOT_STYLE_DFT);
          currentWhitePixels++;
        }
        
        // Draw to red buffer  
        Paint_SelectImage(redBuffer);
        if (pixelValue == 2) {
          Paint_DrawPoint(x, y, BLACK, DOT_PIXEL_1X1, DOT_STYLE_DFT);  // RED pixels are BLACK in red buffer
          currentRedPixels++;
        } else {
          Paint_DrawPoint(x, y, WHITE, DOT_PIXEL_1X1, DOT_STYLE_DFT);  // Non-red pixels are WHITE in red buffer
        }
      }
    }
  }
  
  Serial.printf("BMP processing complete: %d black pixels, %d white pixels, %d red pixels\n", 
                currentBlackPixels, currentWhitePixels, currentRedPixels);
  return true;
}

bool hasImageChanged() {
  // On first display, always return true
  if (isFirstDisplay) {
    Serial.println("First display - will update");
    return true;
  }
  
  // Debug output
  Serial.printf("Current pixel counts - Black: %d, White: %d, Red: %d\n", 
                currentBlackPixels, currentWhitePixels, currentRedPixels);
  Serial.printf("Previous pixel counts - Black: %d, White: %d, Red: %d\n", 
                prevBlackPixels, prevWhitePixels, prevRedPixels);
  
  // Compare pixel counts
  bool changed = (currentBlackPixels != prevBlackPixels) || 
                 (currentWhitePixels != prevWhitePixels) || 
                 (currentRedPixels != prevRedPixels);
  
  if (changed) {
    Serial.println("Change detected in pixel counts");
    return true;
  } else {
    Serial.println("No change detected - identical pixel counts");
    return false;
  }
}

void shutdownDisplay() {
  // Follow demo pattern: clear and sleep only at shutdown
  Serial.println("Shutting down display...");
  EPD_7IN5B_V2_Init();
  EPD_7IN5B_V2_Clear();
  EPD_7IN5B_V2_Sleep();
  Serial.println("Display cleared and put to sleep");
}