// H.A.I.V.A. Hive Orb — native C++ visual-design core.
// Pure C++ geometry/animation prototype. No voice, WebView, V3, or backend.
// Renderer target: any native 3D API (OpenGL ES/Vulkan/etc.).

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace haiva::hive_orb {

constexpr float PI = 3.14159265358979323846f;

struct Vec3 {
    float x{}, y{}, z{};
};

struct HiveCell {
    Vec3 normal{};
    Vec3 center{};
    float energy{0.0f};
    float scale{1.0f};
};

struct Vertex {
    Vec3 position{};
    Vec3 normal{};
    float energy{0.0f};
};

class HiveOrbCore {
public:
    // Visual-only controls. They are deliberately independent from H.A.I.V.A. voice systems.
    void setPulse(float value) {
        pulse = std::clamp(value, 0.0f, 1.0f);
    }

    void setRotation(float radians) {
        rotation = radians;
    }

    void build(std::size_t cellCount = 720) {
        cells.clear();
        vertices.clear();
        cells.reserve(cellCount);

        // Fibonacci sphere gives a clean, evenly distributed hive shell.
        const float goldenAngle = PI * (3.0f - std::sqrt(5.0f));

        for (std::size_t i = 0; i < cellCount; ++i) {
            const float t = static_cast<float>(i) / static_cast<float>(cellCount - 1);
            const float y = 1.0f - 2.0f * t;
            const float radius = std::sqrt(std::max(0.0f, 1.0f - y * y));
            const float theta = goldenAngle * static_cast<float>(i);

            Vec3 n{radius * std::cos(theta), y, radius * std::sin(theta)};
            cells.push_back({n, n, 0.12f, 1.0f});
        }

        rebuildMesh();
    }

    void update(float dt) {
        time += std::max(0.0f, dt);
        rotation += dt * 0.16f;
        pulse = std::max(0.0f, pulse - dt * 0.65f);

        for (std::size_t i = 0; i < cells.size(); ++i) {
            auto& cell = cells[i];
            const float phase = std::atan2(cell.normal.z, cell.normal.x)
                              + cell.normal.y * 3.0f;

            // Slow breathing plus a moving energy wave across the shell.
            const float wave = 0.5f + 0.5f *
                std::sin(phase * 8.0f - time * 2.8f);
            const float breathing = 0.5f + 0.5f * std::sin(time * 1.35f);
            const float energyWave = std::pow(std::max(0.0f, wave), 7.0f);

            cell.energy = 0.10f
                + energyWave * (0.22f + pulse * 0.78f)
                + breathing * 0.05f;

            // Cells subtly lift away from the sphere during energy peaks.
            cell.scale = 1.0f + cell.energy * 0.045f;
            cell.center = {
                cell.normal.x * cell.scale,
                cell.normal.y * cell.scale,
                cell.normal.z * cell.scale
            };
        }

        rebuildMesh();
    }

    const std::vector<HiveCell>& cellsData() const { return cells; }
    const std::vector<Vertex>& mesh() const { return vertices; }
    float currentRotation() const { return rotation; }

private:
    static Vec3 cross(Vec3 a, Vec3 b) {
        return {
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        };
    }

    static Vec3 normalize(Vec3 v) {
        const float len = std::sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
        if (len < 0.00001f) return {0.0f, 1.0f, 0.0f};
        return {v.x/len, v.y/len, v.z/len};
    }

    void rebuildMesh() {
        vertices.clear();
        vertices.reserve(cells.size() * 12);

        // Each cell is a real six-sided hexagonal ring on the spherical shell.
        constexpr float cellRadius = 0.0375f;
        constexpr float shellRadius = 1.002f;

        for (const auto& cell : cells) {
            const Vec3 n = normalize(cell.normal);
            Vec3 tangent = normalize(cross({0.0f, 1.0f, 0.0f}, n));
            if (std::abs(n.y) > 0.92f) {
                tangent = normalize(cross({1.0f, 0.0f, 0.0f}, n));
            }
            const Vec3 bitangent = normalize(cross(n, tangent));

            // Six edges = six visible sides of one honeycomb cell.
            for (int side = 0; side < 6; ++side) {
                const float a0 = PI / 6.0f + side * PI / 3.0f;
                const float a1 = PI / 6.0f + (side + 1) * PI / 3.0f;

                const float r = cellRadius * cell.scale;
                const Vec3 p0{
                    n.x * shellRadius + r * (tangent.x * std::cos(a0) + bitangent.x * std::sin(a0)),
                    n.y * shellRadius + r * (tangent.y * std::cos(a0) + bitangent.y * std::sin(a0)),
                    n.z * shellRadius + r * (tangent.z * std::cos(a0) + bitangent.z * std::sin(a0))
                };
                const Vec3 p1{
                    n.x * shellRadius + r * (tangent.x * std::cos(a1) + bitangent.x * std::sin(a1)),
                    n.y * shellRadius + r * (tangent.y * std::cos(a1) + bitangent.y * std::sin(a1)),
                    n.z * shellRadius + r * (tangent.z * std::cos(a1) + bitangent.z * std::sin(a1))
                };

                vertices.push_back({p0, n, cell.energy});
                vertices.push_back({p1, n, cell.energy});
            }
        }
    }

    std::vector<HiveCell> cells;
    std::vector<Vertex> vertices;
    float time{0.0f};
    float rotation{0.0f};
    float pulse{0.0f};
};

} // namespace haiva::hive_orb
