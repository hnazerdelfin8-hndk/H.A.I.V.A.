// H.A.I.V.A. Hive Orb — native C++ prototype core.
// Renderer integration target: Android NDK + OpenGL ES.
#include <cmath>
#include <vector>
#include <algorithm>

struct HiveCell { float x,y,z,energy; };

class HiveOrbCore {
public:
  void setVoiceEnergy(float value) { voiceEnergy = std::clamp(value,0.0f,1.0f); }
  void setImpulse(float value) { impulse = std::max(impulse,value); }
  void update(float dt) {
    time += dt;
    impulse = std::max(0.0f, impulse - dt*0.8f);
    const float drive = std::max(voiceEnergy, impulse);
    for (auto &c : cells) {
      const float phase = std::atan2(c.z,c.x) + c.y*3.0f;
      const float wave = 0.5f + 0.5f*std::sin(phase*8.0f - time*4.0f);
      c.energy = 0.12f + drive*std::pow(std::max(0.0f,wave),8.0f);
    }
  }
  std::vector<HiveCell> cells;
private:
  float time=0, voiceEnergy=0, impulse=0;
};
