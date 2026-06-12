import os
import sys
import grpc_tools.protoc

def compile_proto():
    # Targets the 'proto' folder sitting right next to this script in the root directory
    proto_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './proto'))
    sys.path.append(proto_path)
    
    # Using flush=True ensures logs print instantly to Docker/CI consoles without buffering
    print(f"--- [PROTO-BUILD] Executing protocol buffer compilation inside: {proto_path} ---", flush=True)
    
    # grpc_tools.protoc.main returns an integer status code (0 for success)
    exit_code = grpc_tools.protoc.main((
        '',
        f'-I{proto_path}',
        f'--python_out={proto_path}',
        f'--grpc_python_out={proto_path}',
        os.path.join(proto_path, 'library.proto')
    ))
    
    if exit_code != 0:
        print(f"ERROR: Protocol buffer compilation failed with exit code {exit_code}", file=sys.stderr, flush=True)
        sys.exit(exit_code) # Forces Docker build/start process to stop immediately on error
        
    print("--- [PROTO-BUILD] Compilation completed cleanly. Artifacts generated. ---", flush=True)

if __name__ == '__main__':
    compile_proto()