@echo off
where dosbox-x 2>nul >nul
if %ERRORLEVEL% NEQ 0 (
    where dosbox 2>nul >nul
    if %ERRORLEVEL% NEQ 0 (
        if not exist "%DOSBOX_PATH%\dosbox-x.exe" (
            echo Downloading DOSBox-X...
            curl -L https://github.com/joncampbell123/dosbox-x/releases/download/dosbox-x-v2024.07.01/dosbox-x-mingw-win32-lowend9x-20240702034526.zip -o dosbox.zip
            tar -xf dosbox.zip mingw-build/mingw
            move mingw-build/mingw dosbox-x
            rmdir mingw-build
            del dosbox.zip
            setx DOSBOX_PATH "%cd%\dosbox-x"
            set DOSBOX_PATH=%cd%\dosbox-x
        )
        if exist "%DOSBOX_PATH%\dosbox-x.exe" (
            setx PATH "%PATH%;%DOSBOX_PATH%"
        )
    )
)
where nasm 2>nul >nul
if %ERRORLEVEL% NEQ 0 (
    if not exist "%NASM_PATH%\nasm.exe" (
        echo Downloading NASM...
        curl -L https://www.nasm.us/pub/nasm/releasebuilds/2.16.03/win64/nasm-2.16.03-win64.zip -o nasm.zip
        tar -xf nasm.zip
        move nasm-2.16.03 nasm
        del nasm.zip
        del nasm\LICENSE
        setx NASM_PATH "%cd%\nasm"
        set NASM_PATH=%cd%\nasm
    )
    if exist "%NASM_PATH%\nasm.exe" (
        setx PATH "%PATH%;%NASM_PATH%"
    )
)

where code 2>nul >nul
if %ERRORLEVEL% NEQ 0 (
    if not exist "%VSCODE_PATH%\Code.exe" (
        echo Downloading Visual Studio Code...
        mkdir vscode
        cd vscode
        curl -L "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-archive" -o vscode.zip
        tar -xf vscode.zip
        del vscode.zip
        mkdir data
        cd ..
        setx VSCODE_PATH "%cd%\vscode\bin"
        set VSCODE_PATH=%cd%\vscode\bin
        echo {^"nasm-tools.nasmCommand^": ^"%NASM_PATH%\nasm.exe^", ^"nasm-tools.dosboxCommand^": ^"%DOSBOX_PATH%\dosbox-x.exe^"} >> %cd%\vscode\data\user-data\User\settings.json
    )
    if exist "%VSCODE_PATH%\Code.exe" (
        set VSCODE_COMMAND="%VSCODE_PATH%\code"
        set VSCODE_PATH=
        setx PATH "%PATH%;^%VSCODE_PATH^%"
    )
)
where code 2>nul >nul
if %ERRORLEVEL% EQU 0 (
    set VSCODE_COMMAND=code
)

%VSCODE_COMMAND% --install-extension nottahaali.nasm-tools --force

%VSCODE_COMMAND%