
cmake_minimum_required(VERSION 3.20)

project(EASE_Backend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(mongocxx REQUIRED)
find_package(bsoncxx REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)

# cpp-httplib is header-only. CMake only needs to find its include folder.
find_path(HTTPLIB_INCLUDE_DIR httplib.h REQUIRED)

add_executable(ease_backend
    routers/main.cpp
    routers/AuthRouter.cpp
    routers/GraphRouter.cpp
    routers/MessageRouter.cpp
    routers/OpsRouter.cpp
    routers/ReportRouter.cpp
    models/Models.cpp
)

target_include_directories(ease_backend PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/routers"
    "${CMAKE_CURRENT_SOURCE_DIR}/models"
    "${HTTPLIB_INCLUDE_DIR}"
)

target_link_libraries(ease_backend PRIVATE
    mongo::mongocxx_shared
    mongo::bsoncxx_shared
    OpenSSL::Crypto
    nlohmann_json::nlohmann_json
)

if(WIN32)
    target_link_libraries(ease_backend PRIVATE ws2_32 crypt32)
endif()




