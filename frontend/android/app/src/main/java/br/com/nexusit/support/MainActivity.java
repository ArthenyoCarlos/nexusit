package br.com.nexusit.support;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.IOException;

public class MainActivity extends BridgeActivity {
    private static final int RC_AUDIO = 1001;
    private static final int RC_FILE_CHOOSER = 1002;

    private PermissionRequest pendingMicRequest;
    private ValueCallback<Uri[]> pendingFileCallback;
    private Uri pendingCameraUri;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Pede a permissão de microfone já na abertura do app (em vez de só na hora de
        // gravar) — o fluxo assíncrono via onPermissionRequest sozinho é pouco confiável
        // em alguns WebViews Android; com a permissão já concedida de antemão, o
        // onPermissionRequest abaixo consegue liberar de forma síncrona.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, RC_AUDIO);
        }

        // O WebView puro do Capacitor não pede permissão de microfone (necessário
        // para a gravação de áudio do CRM) nem abre o seletor de arquivo/câmera
        // (necessário para anexar arquivos e tirar fotos) sem esses dois handlers.
        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                    } else {
                        pendingMicRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.RECORD_AUDIO}, RC_AUDIO);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                              FileChooserParams fileChooserParams) {
                pendingFileCallback = filePathCallback;
                pendingCameraUri = null;

                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("*/*");
                Intent chooserIntent = Intent.createChooser(contentIntent, "Selecionar arquivo");

                // Adiciona "Câmera" como opção no mesmo seletor, ao lado de galeria/arquivos.
                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (cameraIntent.resolveActivity(getPackageManager()) != null) {
                    try {
                        File photoFile = File.createTempFile("photo_", ".jpg", getCacheDir());
                        pendingCameraUri = FileProvider.getUriForFile(
                                MainActivity.this, getPackageName() + ".fileprovider", photoFile);
                        cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                        cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        // Sem isto, a WebView não consegue reabrir o arquivo pra ler os bytes
                        // depois que a câmera devolve o controle — a foto "anexa" mas não envia.
                        grantUriPermission(getPackageName(), pendingCameraUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                    } catch (IOException e) {
                        pendingCameraUri = null;
                    }
                }

                startActivityForResult(chooserIntent, RC_FILE_CHOOSER);
                return true;
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == RC_AUDIO && pendingMicRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingMicRequest.grant(pendingMicRequest.getResources());
            } else {
                pendingMicRequest.deny();
            }
            pendingMicRequest = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == RC_FILE_CHOOSER && pendingFileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                } else if (pendingCameraUri != null) {
                    result = new Uri[]{pendingCameraUri};
                }
            }
            pendingFileCallback.onReceiveValue(result);
            pendingFileCallback = null;
            pendingCameraUri = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }
}
