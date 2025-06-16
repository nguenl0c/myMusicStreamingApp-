import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Cập nhật state để hiển thị UI fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log lỗi để debug
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Gửi lỗi đến service monitoring (optional)
    // logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    // Reload trang hoặc reset state
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    window.location.reload();
  };

  handleGoBack = () => {
    // Quay lại trang trước
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      // UI fallback khi có lỗi
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">Đã xảy ra lỗi</h2>
            <p className="text-gray-300 mb-6">
              Ứng dụng đã gặp phải một lỗi không mong muốn. 
              Vui lòng thử lại hoặc liên hệ với chúng tôi nếu vấn đề vẫn tiếp tục.
            </p>
            
            {/* Chi tiết lỗi chỉ hiển thị trong development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-yellow-400 mb-2">
                  Chi tiết lỗi (Development)
                </summary>
                <div className="bg-gray-900 p-3 rounded text-xs overflow-auto max-h-40">
                  <div className="text-red-400 font-semibold">{this.state.error.toString()}</div>
                  <div className="text-gray-400 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </div>
                </div>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-[#1DB954] hover:bg-[#1ed760] text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                🔄 Tải lại trang
              </button>
              <button
                onClick={this.handleGoBack}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                ← Quay lại
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400">
                Nếu vấn đề vẫn tiếp tục, vui lòng{' '}
                <a 
                  href="mailto:support@example.com" 
                  className="text-[#1DB954] hover:underline"
                >
                  liên hệ hỗ trợ
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 