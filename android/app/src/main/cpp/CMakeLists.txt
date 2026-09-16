cmake_minimum_required(VERSION 3.22.1)
project(haiva_hive_orb)

add_library(haiva_hive_orb SHARED
    HiveOrbRenderer.cpp
)

target_link_libraries(haiva_hive_orb
    GLESv2
    log
    android
)
