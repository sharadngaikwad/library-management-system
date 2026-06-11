import os
import sys
import grpc_tools.protoc

def compile_proto():
    # Targets the 'proto' folder sitting right next to this script in the root directory
    proto_path = os.path.abspath(os.path.join(os.path.dirname(__file__), './proto'))
    sys.path.append(proto_path)
    
    print(f"Executing protocol buffer compilation inside path: {proto_path}")
    grpc_tools.protoc.main((
        '',
        f'-I{proto_path}',
        f'--python_out={proto_path}',
        f'--grpc_python_out={proto_path}',
        os.path.join(proto_path, 'library.proto')
    ))
    print("Compilation completed cleanly.")

if __name__ == '__main__':
    compile_proto()