#include <jni.h>
#include <GLES2/gl2.h>
#include <android/log.h>
#include <cmath>
#include <vector>
#include <algorithm>

namespace {
struct V { float x,y,z,e; };
std::vector<V> verts;
float t=0.0f, spin=0.0f, pulse=0.0f;
int width=1, height=1;

float clamp01(float v){ return std::max(0.0f,std::min(1.0f,v)); }

void buildShell(){
    verts.clear();
    constexpr int cells=720;
    constexpr float pi=3.14159265359f;
    const float golden=pi*(3.0f-std::sqrt(5.0f));
    const float size=0.027f;
    for(int i=0;i<cells;i++){
        float y=1.0f-2.0f*i/float(cells-1);
        float r=std::sqrt(std::max(0.0f,1.0f-y*y));
        float th=golden*i;
        float x=r*std::cos(th), z=r*std::sin(th);
        float ax=-y, ay=x, az=0.0f;
        float al=std::sqrt(ax*ax+ay*ay)+1e-6f; ax/=al; ay/=al;
        float bx=y*az-z*ay, by=z*ax-x*az, bz=x*ay-y*ax;
        for(int j=0;j<6;j++){
            float a=pi/6.0f+j*pi/3.0f;
            float b=pi/6.0f+(j+1)*pi/3.0f;
            verts.push_back({x+size*(ax*std::cos(a)+bx*std::sin(a)),
                             y+size*(ay*std::cos(a)+by*std::sin(a)),
                             z+size*(az*std::cos(a)+bz*std::sin(a)),0.0f});
            verts.push_back({x+size*(ax*std::cos(b)+bx*std::sin(b)),
                             y+size*(ay*std::cos(b)+by*std::sin(b)),
                             z+size*(az*std::cos(b)+bz*std::sin(b)),0.0f});
        }
    }
}

void perspective(float fov,float aspect,float zn,float zf,float* m){
    float f=1.0f/std::tan(fov*0.5f);
    for(int i=0;i<16;i++) m[i]=0;
    m[0]=f/aspect; m[5]=f; m[10]=(zf+zn)/(zn-zf); m[11]=-1; m[14]=(2*zf*zn)/(zn-zf);
}

void multiply(const float*a,const float*b,float*out){
    float r[16];
    for(int c=0;c<4;c++) for(int r0=0;r0<4;r0++){
        r[c*4+r0]=0;
        for(int k=0;k<4;k++) r[c*4+r0]+=a[k*4+r0]*b[c*4+k];
    }
    for(int i=0;i<16;i++) out[i]=r[i];
}

void rotateY(float a,float*m){
    for(int i=0;i<16;i++)m[i]=0;
    float c=std::cos(a),s=std::sin(a);
    m[0]=c;m[2]=-s;m[5]=1;m[8]=s;m[10]=c;m[15]=1;
}

void rotateX(float a,float*m){
    for(int i=0;i<16;i++)m[i]=0;
    float c=std::cos(a),s=std::sin(a);
    m[0]=1;m[5]=c;m[6]=s;m[9]=-s;m[10]=c;m[15]=1;
}
}

extern "C" JNIEXPORT void JNICALL Java_com_haiva_app_HiveOrbRenderer_nativeInit(JNIEnv*,jobject){
    buildShell();
    glClearColor(0.002f,0.012f,0.006f,1.0f);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA,GL_ONE);
    glEnable(GL_DEPTH_TEST);
}

extern "C" JNIEXPORT void JNICALL Java_com_haiva_app_HiveOrbRenderer_nativeResize(JNIEnv*,jobject,jint w,jint h){
    width=std::max(1,(int)w); height=std::max(1,(int)h); glViewport(0,0,width,height);
}

extern "C" JNIEXPORT void JNICALL Java_com_haiva_app_HiveOrbRenderer_nativePulse(JNIEnv*,jobject){ pulse=1.0f; }

extern "C" JNIEXPORT void JNICALL Java_com_haiva_app_HiveOrbRenderer_nativeRender(JNIEnv*,jobject,jfloat dt){
    t+=dt; spin+=dt*0.18f; pulse=std::max(0.0f,pulse-dt*1.25f);
    glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);

    static const char* vs="attribute vec4 a;uniform mat4 u;varying float e;void main(){e=a.w;gl_Position=u*vec4(a.xyz,1.0);gl_PointSize=2.0;}";
    static const char* fs="precision mediump float;varying float e;void main(){float glow=.15+.85*e;gl_FragColor=vec4(.02,.95,.30,glow);} ";
    static GLuint program=0;
    if(!program){
        auto compile=[](GLenum type,const char*src){GLuint s=glCreateShader(type);glShaderSource(s,1,&src,nullptr);glCompileShader(s);return s;};
        program=glCreateProgram(); GLuint a=compile(GL_VERTEX_SHADER,vs),b=compile(GL_FRAGMENT_SHADER,fs);
        glAttachShader(program,a);glAttachShader(program,b);glLinkProgram(program);glDeleteShader(a);glDeleteShader(b);
    }
    std::vector<float> data; data.reserve(verts.size()*4);
    constexpr int cells=720;
    const float golden=3.14159265359f*(3.0f-std::sqrt(5.0f));
    for(int i=0;i<cells;i++){
        float y=1.0f-2.0f*i/float(cells-1), r=std::sqrt(std::max(0.0f,1-y*y)), th=golden*i;
        float wave=.5f+.5f*std::sin(th*7.0f-t*2.6f);
        float e=.10f+std::pow(wave,9.0f)*(.18f+.82f*std::max(pulse,.35f+.18f*std::sin(t*1.7f)));
        float k=1.0f+.045f*e;
        int base=i*12;
        for(int q=0;q<12;q++) data.push_back(verts[base+q].x*k),data.push_back(verts[base+q].y*k),data.push_back(verts[base+q].z*k),data.push_back(clamp01(e));
    }
    float p[16],rx[16],ry[16],model[16],mvp[16];
    perspective(1.05f,float(width)/float(height),.1f,20.0f,p); rotateX(.18f,rx); rotateY(spin,ry); multiply(ry,rx,model);
    model[12]=0;model[13]=0;model[14]=-3.15f;model[15]=1;
    multiply(p,model,mvp);
    glUseProgram(program); glUniformMatrix4fv(glGetUniformLocation(program,"u"),1,GL_FALSE,mvp);
    GLuint vbo; glGenBuffers(1,&vbo); glBindBuffer(GL_ARRAY_BUFFER,vbo); glBufferData(GL_ARRAY_BUFFER,data.size()*sizeof(float),data.data(),GL_STREAM_DRAW);
    GLint loc=glGetAttribLocation(program,"a"); glEnableVertexAttribArray(loc); glVertexAttribPointer(loc,4,GL_FLOAT,GL_FALSE,16,(void*)0);
    glDrawArrays(GL_LINES,0,(GLsizei)verts.size()); glDisableVertexAttribArray(loc); glDeleteBuffers(1,&vbo);
}
